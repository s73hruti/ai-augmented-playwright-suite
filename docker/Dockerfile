# QuickBite Playwright Suite — CI runner image
FROM mcr.microsoft.com/playwright:v1.47.2-jammy AS base

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .

RUN npx playwright install --with-deps chromium

ENV CI=true

CMD ["npm", "run", "test:e2e"]