FROM pochi-browser-verification-base

RUN npm i -g @wasp.sh/wasp-cli@latest

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-initialize a wasp project
WORKDIR /home/user
RUN wasp new my-app -t minimal

LABEL Author="any-task-builder"
LABEL Description="Wasp development environment for Hello World task."

# Container contents:
# 1. Wasp CLI
# 2. Node.js 24.x
# 3. Python 3 and pytest for verification

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

CMD ["/bin/bash"]
