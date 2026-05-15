module.exports = {
    apps: [
        {
            name: 'SAIL-Technical-App', // Replace with your application's name
            script: 'dist/index.js', // Replace with the entry point script of your application
            instances: 1, // The number of instances you want to run (usually set to 1 for single instance)
            autorestart: true, // Automatically restart the application if it crashes
            watch: false, // Set to true if you want pm2 to watch for file changes and automatically reload
            // max_memory_restart: '1G', // Restart the application if memory usage exceeds this limit
				 // Default environment (used if no --env flag passed)
		env: {
			APP_ENV: "dev",
			NODE_ENV: "development",
			EXTERNAL_MASTER_DATA_URL_DEV:"https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata",
            SYNC_INSTANCE_ID:"SHORE-PROD"
		},
		env_production: {
			APP_ENV: "production",
			NODE_ENV:"production",
			EXTERNAL_MASTER_DATA_URL_PROD:"https://sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata"
		}
		},
    ],
};