# VPS Deployment Guide for OpUtilityBot

## 🚀 Quick Deployment Steps

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install PM2
sudo npm install -g pm2

# Install Nginx (optional)
sudo apt install nginx -y
```

### 2. Database Setup
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE oputilitybot;
CREATE USER botuser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE oputilitybot TO botuser;
\q
```

### 3. Application Setup
```bash
# Clone your repository
git clone https://github.com/shinys129/OpUtilityBot.git
cd OpUtilityBot

# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env
```

### 4. Environment Configuration
```bash
# .env file content
DISCORD_TOKEN=your_discord_bot_token_here
DATABASE_URL=postgresql://botuser:your_secure_password@localhost:5432/oputilitybot
PORT=3000
NODE_ENV=production
```

### 5. Build and Migrate
```bash
# Build the application
npm run build

# Run database migrations (you'll need to create the migration files)
npm run db:migrate
```

### 6. PM2 Configuration
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'oputilitybot',
    script: 'dist/server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 7. Start Application
```bash
# Create logs directory
mkdir logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔧 Production Fixes Applied

### Storage Layer Simplification
- Replaced complex SQL joins with simpler queries
- Fixed date comparison issues
- Removed problematic alias operations
- Added proper error handling

### Environment Variables
- Added production-ready environment configuration
- Database connection string format
- Security considerations

### Process Management
- PM2 configuration for auto-restart
- Memory limits and monitoring
- Log rotation setup

## 🛡️ Security Setup

### Firewall Configuration
```bash
# Configure UFW
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### SSL Certificate (Optional)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### File Permissions
```bash
# Secure environment file
chmod 600 .env

# Set proper ownership
sudo chown -R $USER:$USER .
```

## 📊 Monitoring

### PM2 Monitoring
```bash
# View logs
pm2 logs

# Monitor status
pm2 monit

# Restart application
pm2 restart oputilitybot

# View statistics
pm2 show oputilitybot
```

### Log Rotation
```bash
# Install log rotation
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

## 🔄 Nginx Reverse Proxy (Optional)

Create `/etc/nginx/sites-available/oputilitybot`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/oputilitybot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running: `sudo systemctl status postgresql`
   - Verify credentials in .env file
   - Check database exists: `sudo -u postgres psql -l`

2. **Bot Token Invalid**
   - Verify Discord bot token is correct
   - Check bot has proper intents enabled

3. **Permission Denied**
   - Check file permissions: `ls -la`
   - Ensure proper ownership: `sudo chown -R $USER:$USER .`

4. **Memory Issues**
   - Increase PM2 memory limit in ecosystem.config.js
   - Add swap space if needed

### Debug Commands
```bash
# Check PM2 status
pm2 status

# View real-time logs
pm2 logs --lines 100

# Restart in development mode
pm2 delete oputilitybot
NODE_ENV=development npm run dev

# Check system resources
free -h
df -h
```

## 📝 Maintenance

### Regular Updates
```bash
# Update dependencies
npm update

# Rebuild after updates
npm run build
pm2 restart oputilitybot

# System updates
sudo apt update && sudo apt upgrade -y
```

### Backup Strategy
```bash
# Database backup
pg_dump -h localhost -U botuser oputilitybot > backup.sql

# Application backup
tar -czf oputilitybot-backup.tar.gz .
```

## 🎯 Next Steps

1. **Test all commands** after deployment
2. **Set up monitoring alerts** for downtime
3. **Configure backup automation**
4. **Set up domain and SSL** if using web interface
5. **Test user management features** thoroughly

Your OpUtilityBot is now ready for production VPS deployment! 🚀
