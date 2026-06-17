FROM pochi-browser-verification-base

RUN npm i -g @wasp.sh/wasp-cli@latest

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Wasp development environment with Node.js 24.x and Wasp CLI for building full-stack web applications."

# Container contents:
# 1. For development:
#   - Node.js 24.x and npm
#   - Wasp CLI (@wasp.sh/wasp-cli)
#   - Git for project initialization
# 2. For automated verification:
#   - Python 3, pip, and pytest
#   - curl for network checks

CMD ["/bin/bash"]
