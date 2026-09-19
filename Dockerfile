# ---- base: shared Go toolchain layer -------------------------------------
FROM golang:1.26-alpine AS base
WORKDIR /app
RUN apk add --no-cache git ca-certificates tzdata
COPY go.mod go.sum* ./
RUN go mod download || true

# ---- dev: hot reload via air ---------------------------------------------
FROM base AS dev
RUN go install github.com/air-verse/air@latest
COPY . .
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

# ---- build ---------------------------------------------------------------
FROM base AS build
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- prod: distroless-ish runtime ----------------------------------------
FROM alpine:3.20 AS prod
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /out/server /app/server
RUN mkdir -p /data/uploads && chown -R app /data/uploads
ENV UPLOAD_DIR=/data/uploads
VOLUME ["/data/uploads"]
USER app
EXPOSE 8080
ENTRYPOINT ["/app/server"]
