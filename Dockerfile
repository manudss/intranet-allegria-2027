# syntax=docker/dockerfile:1
# Image de production de l'API Allegria (NestJS).
#
# Pourquoi : les builds se font sur GitHub Actions (gratuits sur ce repo public)
# et Render ne fait QUE tirer l'image GHCR et la demarrer : zero minute de build
# sur les 500 minutes de pipeline gratuites partagees du workspace.
#
# Les migrations TypeORM ne sont PAS dans cette image ni dans son demarrage :
# elles tournent dans le job "migrate" du workflow prod-deploy.yml AVANT le
# declenchement du deploy Render. Un echec de migration bloque donc le deploy,
# au lieu de faire tomber le service apres coup.

FROM node:24.15.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx nx build api --configuration production

FROM node:24.15.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/apps/api ./dist/apps/api
# Render fournit PORT ; l'API ecoute dessus (defaut 3000 en local).
EXPOSE 3000
CMD ["node", "dist/apps/api/main.js"]
