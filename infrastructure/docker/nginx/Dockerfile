# Build stage for VTS module
FROM alpine:latest AS build-stage

ENV NGINX_VERSION=1.24.0

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    g++ \
    make \
    wget \
    git \
    tar \
    zlib-dev \
    pcre-dev \
    openssl-dev \
    gd-dev

# Get nginx source and VTS module
RUN wget https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz \
    && tar -zxvf nginx-${NGINX_VERSION}.tar.gz \
    && git clone https://github.com/vozlt/nginx-module-vts.git

# Build VTS module
RUN cd nginx-${NGINX_VERSION} \
    && ./configure --with-compat --add-dynamic-module=/nginx-module-vts \
    && make modules

# Final stage - using official nginx alpine image
FROM nginx:1.24.0-alpine

# Copy VTS module from build stage
COPY --from=build-stage /nginx-${NGINX_VERSION}/objs/ngx_http_vhost_traffic_status_module.so /etc/nginx/modules/

# Forward logs to Docker log collector
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log
