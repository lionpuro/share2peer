FROM golang:1.25.4-bookworm AS build
WORKDIR /src
COPY . .
RUN go mod download && go mod verify
RUN go build -v -o /out/server .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates
WORKDIR /app
COPY --from=build /out/server .

CMD ["/app/server"]
