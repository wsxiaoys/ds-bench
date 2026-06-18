# Prefect Docker Deployment Infrastructure

## Background
Prefect allows you to orchestrate workflows and run them in various infrastructure environments, such as Docker containers. In this task, you will set up a Docker work pool and create a deployment for a simple Python flow to be executed in a Docker container.

## Requirements
- Start a local Prefect server.
- Create a Docker work pool named `my-docker-pool`.
- Create a Python file `/home/user/project/flow.py` containing a flow named `hello_docker_flow` that simply prints a message.
- Deploy the flow to the `my-docker-pool` work pool with the deployment name `docker-deployment` and configure it to use the Docker image `my-prefect-image:latest`.

## Constraints
- Project path: `/home/user/project`
- Work pool name: `my-docker-pool`
- Flow name: `hello_docker_flow`
- Deployment name: `docker-deployment`
- Image: `my-prefect-image:latest`
- The Prefect server must be running locally.