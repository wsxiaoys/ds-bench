FROM pochi-browser-verification-base

RUN npm i -g @wasp.sh/wasp-cli@latest

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Wasp development environment with Node.js 24.x and Wasp CLI for building full-stack web applications."

CMD ["/bin/bash"]
