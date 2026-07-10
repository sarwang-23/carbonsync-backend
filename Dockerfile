# Use the official Node.js 20 image (Debian-based)
FROM node:20-bullseye-slim

# Install LibreOffice and fonts for PDF conversion
# Also installing basic dependencies needed by Puppeteer just in case
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    ure \
    libreoffice-java-common \
    libreoffice-core \
    libreoffice-common \
    fonts-liberation \
    fonts-croscore \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    libxext6 \
    libxrender1 \
    libnss3 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
# Clean install for production
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# Create necessary runtime directories
RUN mkdir -p generated reports uploads

# Expose the application port (Render usually uses 10000, but respects process.env.PORT)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
