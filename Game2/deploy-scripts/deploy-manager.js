#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class DeploymentManager {
  constructor() {
    this.platforms = {
      netlify: this.deployToNetlify.bind(this),
      vercel: this.deployToVercel.bind(this),
      firebase: this.deployToFirebase.bind(this)
    };
  }

  async deploy(platform, options = {}) {
    console.log(`🚀 Starting deployment to ${platform}...`);
    
    try {
      if (this.platforms[platform]) {
        const result = await this.platforms[platform](options);
        return result;
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error(`❌ Deployment failed: ${error.message}`);
      throw error;
    }
  }

  async deployToNetlify(options) {
    const { environment = 'production' } = options;
    
    console.log('📦 Deploying to Netlify...');
    
    try {
      // Check if Netlify CLI is installed
      execSync('netlify --version', { stdio: 'pipe' });
      
      const command = environment === 'production' 
        ? 'netlify deploy --prod --dir=public'
        : 'netlify deploy --dir=public';
      
      const output = execSync(command, { encoding: 'utf8' });
      
      return {
        success: true,
        platform: 'netlify',
        environment,
        output: this.parseNetlifyOutput(output),
        url: this.extractNetlifyURL(output)
      };
    } catch (error) {
      if (error.message.includes('command not found')) {
        throw new Error('Netlify CLI not installed. Run: npm install -g netlify-cli');
      }
      throw error;
    }
  }

  async deployToVercel(options) {
    const { environment = 'production' } = options;
    
    console.log('⚡ Deploying to Vercel...');
    
    try {
      // Check if Vercel CLI is installed
      execSync('vercel --version', { stdio: 'pipe' });
      
      const command = environment === 'production' 
        ? 'vercel --prod'
        : 'vercel';
      
      const output = execSync(command, { encoding: 'utf8' });
      
      return {
        success: true,
        platform: 'vercel',
        environment,
        output: this.parseVercelOutput(output),
        url: this.extractVercelURL(output)
      };
    } catch (error) {
      if (error.message.includes('command not found')) {
        throw new Error('Vercel CLI not installed. Run: npm install -g vercel');
      }
      throw error;
    }
  }

  async deployToFirebase(options) {
    const { environment = 'production' } = options;
    
    console.log('🔥 Deploying to Firebase...');
    
    try {
      // Check if Firebase CLI is installed
      execSync('firebase --version', { stdio: 'pipe' });
      
      // Ensure firebase.json exists
      if (!fs.existsSync('firebase.json')) {
        this.createFirebaseConfig();
      }
      
      const output = execSync('firebase deploy --only hosting', { encoding: 'utf8' });
      
      return {
        success: true,
        platform: 'firebase',
        environment,
        output: this.parseFirebaseOutput(output),
        url: this.extractFirebaseURL(output)
      };
    } catch (error) {
      if (error.message.includes('command not found')) {
        throw new Error('Firebase CLI not installed. Run: npm install -g firebase-tools');
      }
      throw error;
    }
  }

  createFirebaseConfig() {
    const config = {
      hosting: {
        public: "public",
        ignore: [
          "firebase.json",
          "**/.*",
          "**/node_modules/**"
        ],
        rewrites: [
          {
            source: "**",
            destination: "/index.html"
          }
        ],
        headers: [
          {
            source: "**/*.@(jpg|jpeg|gif|png|svg|webp|js|css|woff|woff2)",
            headers: [
              {
                key: "Cache-Control",
                value: "max-age=31536000"
              }
            ]
          },
          {
            source: "/service-worker.js",
            headers: [
              {
                key: "Cache-Control",
                value: "no-cache"
              }
            ]
          }
        ]
      }
    };
    
    fs.writeFileSync('firebase.json', JSON.stringify(config, null, 2));
    console.log('✅ Created firebase.json configuration');
  }

  parseNetlifyOutput(output) {
    // Extract relevant information from Netlify output
    const lines = output.split('\n');
    const result = {
      siteName: lines.find(line => line.includes('Website URL:'))?.split('URL:')[1]?.trim(),
      deployId: lines.find(line => line.includes('Deploy ID:'))?.split('ID:')[1]?.trim(),
      status: 'success'
    };
    return result;
  }

  parseVercelOutput(output) {
    const lines = output.split('\n');
    const result = {
      url: lines.find(line => line.includes('https://'))?.trim(),
      status: 'success'
    };
    return result;
  }

  parseFirebaseOutput(output) {
    const lines = output.split('\n');
    const result = {
      hostingUrl: lines.find(line => line.includes('Hosting URL:'))?.split('URL:')[1]?.trim(),
      project: lines.find(line => line.includes('Project:'))?.split('Project:')[1]?.trim(),
      status: 'success'
    };
    return result;
  }

  extractNetlifyURL(output) {
    const match = output.match(/Website URL:\s*(https:\/\/[^\s]+)/);
    return match ? match[1] : 'https://your-site.netlify.app';
  }

  extractVercelURL(output) {
    const match = output.match/(https:\/\/[^\s]+\.vercel\.app)/);
    return match ? match[1] : 'https://your-site.vercel.app';
  }

  extractFirebaseURL(output) {
    const match = output.match(/Hosting URL:\s*(https:\/\/[^\s]+)/);
    return match ? match[1] : 'https://your-project.web.app';
  }

  generateDeploymentReport(deployments) {
    const report = {
      timestamp: new Date().toISOString(),
      totalDeployments: deployments.length,
      successful: deployments.filter(d => d.success).length,
      failed: deployments.filter(d => !d.success).length,
      deployments: deployments.map(d => ({
        platform: d.platform,
        environment: d.environment,
        success: d.success,
        url: d.url,
        timestamp: new Date().toISOString()
      }))
    };

    fs.writeFileSync('deployment-report.json', JSON.stringify(report, null, 2));
    return report;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, platform, environment] = process.argv;
  
  const manager = new DeploymentManager();
  
  if (!platform) {
    console.log(`
🚀 Aviator Game Deployment Manager

Usage:
  node deploy-manager.js <platform> [environment]

Platforms:
  netlify    Deploy to Netlify
  vercel     Deploy to Vercel  
  firebase   Deploy to Firebase
  all        Deploy to all platforms

Environments:
  production (default)
  preview
  development

Examples:
  node deploy-manager.js netlify
  node deploy-manager.js all production
    `);
    process.exit(1);
  }

  (async () => {
    try {
      if (platform === 'all') {
        const deployments = [];
        
        for (const p of ['netlify', 'vercel', 'firebase']) {
          try {
            const result = await manager.deploy(p, { environment });
            deployments.push(result);
            console.log(`✅ Successfully deployed to ${p}`);
          } catch (error) {
            console.error(`❌ Failed to deploy to ${p}:`, error.message);
            deployments.push({
              platform: p,
              success: false,
              error: error.message
            });
          }
        }
        
        const report = manager.generateDeploymentReport(deployments);
        console.log('\n📊 Deployment Report:');
        console.log(JSON.stringify(report, null, 2));
        
      } else {
        const result = await manager.deploy(platform, { environment });
        console.log('\n✅ Deployment Successful!');
        console.log('📋 Result:', JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  })();
}

export default DeploymentManager;