# ostinato Helm chart

Single-replica, persistent-volume-backed deploy of [ostinato]. Vanilla
Kubernetes — no assumptions about your ingress controller, your secrets
provider, or what cluster you run.

[ostinato]: https://github.com/awall451/ostinato

## Quick install

```bash
# 1. Create the Strava OAuth secret out-of-band.
kubectl create secret generic ostinato-strava \
  --from-literal=STRAVA_CLIENT_ID=...  \
  --from-literal=STRAVA_CLIENT_SECRET=...

# 2. Install. Pin a real image tag — never :latest.
helm install ostinato ./charts/ostinato \
  --set image.tag=v1.0.0 \
  --set strava.existingSecret=ostinato-strava \
  --set env.STRAVA_REDIRECT_URI=https://ostinato.example.com/auth/callback \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=ostinato.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

## Providing the Strava OAuth secret

Pick one (precedence: `existingSecret` > plain values > sealed values):

### Option A — existing Secret (recommended)

Best for any "real" deployment. Create the Secret however you like
(kubectl, External Secrets, Vault, an init job…). Tell the chart its
name:

```yaml
strava:
  existingSecret: ostinato-strava
```

The Secret must expose two keys: `STRAVA_CLIENT_ID` and
`STRAVA_CLIENT_SECRET`.

### Option B — plain values (dev / test only)

The chart renders a Secret from these values. **The values are visible
via `helm get values` in plaintext** — do not use for prod.

```yaml
strava:
  clientId: "abc123"
  clientSecret: "shhh"
```

### Option C — sealed values (for GitOps + sealed-secrets users)

Requires the [bitnami-labs/sealed-secrets] controller in the cluster.
Encrypt your real values once with `kubeseal`, then commit the encrypted
blobs:

```yaml
strava:
  sealed:
    clientId: AgA...
    clientSecret: AgA...
```

The chart renders a `SealedSecret`; the controller decrypts it into a
native `Secret` of the same name. Re-keying a different cluster requires
re-sealing against that cluster's key.

[bitnami-labs/sealed-secrets]: https://github.com/bitnami-labs/sealed-secrets

## Ingress

`ingress.enabled: false` by default. Two styles supported:

### Standard rules-based (ingress-nginx, Traefik, etc)

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: ostinato.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ostinato-tls
      hosts: [ostinato.example.com]
```

### Tailscale Operator style (single defaultBackend, no rules)

```yaml
ingress:
  enabled: true
  className: tailscale
  annotations:
    tailscale.com/hostname: ostinato
  defaultBackend:
    enabled: true
  tls:
    - hosts: [ostinato]
```

## Persistence

The container writes its SQLite DB and a small `secrets.json`
(refresh-token cache) under `/data`. A PVC is created by default
(5 GiB, your cluster's default StorageClass). Disable with
`persistence.enabled: false` (data won't survive Pod restarts) or reuse
a pre-bound claim with `persistence.existingClaim: my-claim`.

## Single replica — do not raise

`replicaCount` is `1` by design. better-sqlite3 holds an exclusive file
lock and a second concurrent Pod will corrupt the DB. The Deployment
uses `strategy: Recreate` so rollouts don't briefly overlap two Pods.
