FROM registry.access.redhat.com/ubi9/nodejs-22

USER 0

# Python 3.12 is the only "escape tool" — no jq, no git, no extra packages
RUN dnf install -y python3.12 && dnf clean all

# ttyd for web terminal (facilitator watches the agent live)
# SHA256 from https://github.com/tsl0922/ttyd/releases/tag/1.7.7
ARG TTYD_VERSION=1.7.7
ARG TTYD_SHA256=8a217c968aba172e0dbf3f34447218dc015bc4d5e59bf51db2f2cd12b7be4f55
RUN curl -fsSL -o /usr/local/bin/ttyd \
    "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64" && \
    echo "${TTYD_SHA256}  /usr/local/bin/ttyd" | sha256sum -c - && \
    chmod +x /usr/local/bin/ttyd

USER 1001

# Claude Code CLI (agent runtime)
# Trust model: official Anthropic install script downloads a signed binary.
# The script is fetched over HTTPS from claude.ai. Pinning a hash here would
# break on every CLI update; instead, the network tools used to fetch it are
# stripped after build (see below), limiting post-install attack surface.
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/opt/app-root/src/.local/bin:$PATH"

USER 0
RUN mkdir -p /usr/local/lib/neo
USER 1001

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY claude-logged /usr/local/bin/claude-logged
COPY prompt-watcher.sh /usr/local/lib/neo/prompt-watcher.sh
COPY net-monitor.sh /usr/local/lib/neo/net-monitor.sh

WORKDIR /opt/app-root/src

USER 0
# Strip all network tools after build — the agent starts with nothing
RUN rm -f /usr/bin/curl /usr/bin/wget /usr/bin/nc /usr/bin/ncat 2>/dev/null || true
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/claude-logged /usr/local/lib/neo/prompt-watcher.sh /usr/local/lib/neo/net-monitor.sh
USER 1001

CMD ["/usr/local/bin/entrypoint.sh"]
