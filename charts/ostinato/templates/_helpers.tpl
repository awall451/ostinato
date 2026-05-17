{{/* Standard helper boilerplate. */}}

{{- define "ostinato.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "ostinato.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end }}

{{- define "ostinato.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "ostinato.labels" -}}
helm.sh/chart: {{ include "ostinato.chart" . }}
{{ include "ostinato.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "ostinato.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ostinato.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
  Resolve the name of the Secret holding Strava credentials. If the
  user provides an existing one, use that. Otherwise, the chart
  generates "<fullname>-strava" (used by both the Secret and
  SealedSecret templates).
*/}}
{{- define "ostinato.stravaSecretName" -}}
{{- if .Values.strava.existingSecret -}}
{{- .Values.strava.existingSecret -}}
{{- else -}}
{{- printf "%s-strava" (include "ostinato.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
  Resolve the PVC claim name. Honor `persistence.existingClaim` if set.
*/}}
{{- define "ostinato.pvcName" -}}
{{- if .Values.persistence.existingClaim -}}
{{- .Values.persistence.existingClaim -}}
{{- else -}}
{{- printf "%s-data" (include "ostinato.fullname" .) -}}
{{- end -}}
{{- end }}
