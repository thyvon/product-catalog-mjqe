FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/Supplier\ Docs ./Supplier\ Docs
RUN mkdir -p /app/uploads && chown app:app /app/uploads
USER app
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/server.cjs"]
