#!/usr/bin/env python3
"""
🌐 VERCEL AUTOMATION INTEGRATION
Deploy automation as a Vercel serverless function

This creates a Vercel API endpoint that can be called by:
1. Vercel Cron Jobs (scheduled execution)
2. Manual triggers via webhook
3. External monitoring systems

Usage:
    python vercel_automation.py --create-api
    python vercel_automation.py --test-endpoint
"""

import os
import json
import asyncio
from pathlib import Path
import argparse
import logging

logger = logging.getLogger(__name__)

class VercelAutomationDeployer:
    """Deploy automation as Vercel serverless function"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.api_dir = self.project_root / 'api'
        self.automation_dir = Path(__file__).parent
    
    def create_api_endpoint(self):
        """Create Vercel API endpoint for automation"""
        logger.info("🌐 Creating Vercel API endpoint...")
        
        # Create API directory
        self.api_dir.mkdir(exist_ok=True)
        
        # Create automation endpoint
        api_code = '''import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add automation directory to path
sys.path.append(str(Path(__file__).parent.parent / 'automation'))

from auto_collect_events import MasterEventsCollector
from supabase_integration import SupabaseEventImporter, SupabaseConfig

async def handler(request):
    """Vercel serverless function handler"""
    
    # Parse request
    if request.method == 'GET':
        # Health check
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'service': 'Master Events Calendar Automation'
            })
        }
    
    elif request.method == 'POST':
        # Run automation
        try:
            # Parse request body
            body = json.loads(request.body) if request.body else {}
            dry_run = body.get('dry_run', False)
            specific_gym = body.get('gym')
            
            # Initialize collector
            async with MasterEventsCollector() as collector:
                if specific_gym:
                    events = await collector.collect_gym_events(specific_gym.upper())
                else:
                    events = await collector.collect_all_gyms()
                
                if not events:
                    return {
                        'statusCode': 200,
                        'body': json.dumps({
                            'status': 'success',
                            'message': 'No events found',
                            'events_collected': 0
                        })
                    }
                
                # Save events
                json_file = collector.save_events_json()
                
                if dry_run:
                    return {
                        'statusCode': 200,
                        'body': json.dumps({
                            'status': 'success',
                            'message': 'Dry run completed',
                            'events_collected': len(events),
                            'file': json_file
                        })
                    }
                
                # Import to Supabase
                config = SupabaseConfig.from_env()
                if not config.key:
                    return {
                        'statusCode': 500,
                        'body': json.dumps({
                            'status': 'error',
                            'message': 'Supabase configuration missing'
                        })
                    }
                
                importer = SupabaseEventImporter(config)
                import_stats = await importer.import_events_from_file(json_file)
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'status': 'success',
                        'message': 'Automation completed',
                        'events_collected': len(events),
                        'new_events': import_stats['new_events'],
                        'updated_events': import_stats['updated_events'],
                        'skipped_duplicates': import_stats['skipped_duplicates'],
                        'errors': import_stats['errors']
                    })
                }
        
        except Exception as e:
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'status': 'error',
                    'message': str(e)
                })
            }
    
    else:
        return {
            'statusCode': 405,
            'body': json.dumps({
                'status': 'error',
                'message': 'Method not allowed'
            })
        }

# Vercel function export
def handler(request):
    return asyncio.run(handler_async(request))

async def handler_async(request):
    return await handler(request)
'''
        
        # Write API file
        api_file = self.api_dir / 'automation.py'
        with open(api_file, 'w') as f:
            f.write(api_code)
        
        logger.info(f"📝 Created API endpoint: {api_file}")
        
        # Create requirements for Vercel
        vercel_requirements = '''# Vercel serverless function requirements
aiohttp>=3.8.0
supabase>=1.0.0
python-dateutil>=2.8.0
'''
        
        req_file = self.api_dir / 'requirements.txt'
        with open(req_file, 'w') as f:
            f.write(vercel_requirements)
        
        logger.info(f"📝 Created Vercel requirements: {req_file}")
        
        return True
    
    def create_vercel_config(self):
        """Create Vercel configuration for automation"""
        logger.info("⚙️ Creating Vercel configuration...")
        
        # Update vercel.json
        vercel_config = {
            "functions": {
                "api/automation.py": {
                    "runtime": "python3.9"
                }
            },
            "crons": [
                {
                    "path": "/api/automation",
                    "schedule": "0 6 * * *"
                }
            ],
            "env": {
                "SUPABASE_URL": "@supabase_url",
                "SUPABASE_ANON_KEY": "@supabase_anon_key"
            }
        }
        
        vercel_file = self.project_root / 'vercel.json'
        
        # Read existing vercel.json if it exists
        existing_config = {}
        if vercel_file.exists():
            with open(vercel_file, 'r') as f:
                existing_config = json.load(f)
        
        # Merge configurations
        merged_config = {**existing_config, **vercel_config}
        
        with open(vercel_file, 'w') as f:
            json.dump(merged_config, f, indent=2)
        
        logger.info(f"📝 Updated Vercel configuration: {vercel_file}")
        
        return True
    
    def create_deployment_script(self):
        """Create deployment script"""
        logger.info("🚀 Creating deployment script...")
        
        deploy_script = '''#!/bin/bash
# Master Events Calendar - Vercel Deployment Script

echo "🚀 Deploying Master Events Calendar with Automation..."

# Install Vercel CLI if not present
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Set environment variables
echo "🔧 Setting up environment variables..."
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo "🔗 Your automation endpoint: https://your-app.vercel.app/api/automation"
echo "📅 Cron job will run daily at 6:00 AM"
'''
        
        deploy_file = self.automation_dir / 'deploy_to_vercel.sh'
        with open(deploy_file, 'w') as f:
            f.write(deploy_script)
        
        # Make executable
        os.chmod(deploy_file, 0o755)
        
        logger.info(f"📝 Created deployment script: {deploy_file}")
        
        return True
    
    def create_webhook_examples(self):
        """Create webhook examples for external triggers"""
        logger.info("🔗 Creating webhook examples...")
        
        webhook_examples = {
            "manual_trigger": {
                "url": "https://your-app.vercel.app/api/automation",
                "method": "POST",
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": {
                    "dry_run": false,
                    "gym": null
                }
            },
            "test_single_gym": {
                "url": "https://your-app.vercel.app/api/automation",
                "method": "POST",
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": {
                    "dry_run": true,
                    "gym": "CCP"
                }
            },
            "health_check": {
                "url": "https://your-app.vercel.app/api/automation",
                "method": "GET"
            }
        }
        
        webhook_file = self.automation_dir / 'webhook_examples.json'
        with open(webhook_file, 'w') as f:
            json.dump(webhook_examples, f, indent=2)
        
        logger.info(f"📝 Created webhook examples: {webhook_file}")
        
        return True
    
    def run_complete_deployment(self):
        """Run complete Vercel deployment setup"""
        logger.info("🌐 Setting up Vercel automation deployment...")
        
        steps = [
            ("Creating API endpoint", self.create_api_endpoint),
            ("Creating Vercel config", self.create_vercel_config),
            ("Creating deployment script", self.create_deployment_script),
            ("Creating webhook examples", self.create_webhook_examples),
        ]
        
        for step_name, step_func in steps:
            logger.info(f"📋 {step_name}...")
            try:
                result = step_func()
                if result:
                    logger.info(f"✅ {step_name} completed")
                else:
                    logger.error(f"❌ {step_name} failed")
                    return False
            except Exception as e:
                logger.error(f"❌ {step_name} failed: {e}")
                return False
        
        logger.info("🎉 Vercel deployment setup complete!")
        logger.info("🚀 Next steps:")
        logger.info("1. Run: ./deploy_to_vercel.sh")
        logger.info("2. Set environment variables in Vercel dashboard")
        logger.info("3. Test endpoint: GET /api/automation")
        
        return True

def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(description='Vercel Automation Deployment')
    parser.add_argument('--create-api', action='store_true', help='Create API endpoint')
    parser.add_argument('--test-endpoint', action='store_true', help='Test endpoint')
    parser.add_argument('--all', action='store_true', help='Run complete deployment setup')
    
    args = parser.parse_args()
    
    deployer = VercelAutomationDeployer()
    
    if args.create_api:
        deployer.create_api_endpoint()
    elif args.test_endpoint:
        logger.info("🧪 Test your endpoint with: curl https://your-app.vercel.app/api/automation")
    elif args.all:
        deployer.run_complete_deployment()
    else:
        # Default: run complete deployment
        deployer.run_complete_deployment()

if __name__ == "__main__":
    main()

