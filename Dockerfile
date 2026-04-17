FROM node:20-alpine
RUN npm install -g @mcpguards/mcp-lock
ENTRYPOINT ["mcp-lock"]
CMD ["--help"]
