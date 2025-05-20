/**
 * This script runs semantic-release in dry-run mode to analyze what would be released
 * if the current changes were merged to the main branch.
 * 
 * It can be used locally to preview the release before creating a PR.
 */

const { execSync } = require('child_process');

// Function to execute shell commands and return output
function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    }).trim();
  } catch (error) {
    if (options.ignoreError) {
      return '';
    }
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Main function
async function analyzeRelease() {
  try {
    console.log('🔍 Analyzing potential release...');
    
    // Check if we're in a PR branch
    const currentBranch = exec('git branch --show-current', { silent: true });
    const mainBranch = 'main';
    
    if (currentBranch === mainBranch) {
      console.warn('⚠️ You are currently on the main branch. This analysis is more useful on feature branches.');
    }
    
    // Run semantic-release in dry-run mode
    console.log('\n📋 Running semantic-release in dry-run mode...');
    exec('npx semantic-release --dry-run');
    
    console.log('\n✅ Analysis complete!');
    console.log('Note: This is a preview of what would be released if merged to main.');
    console.log('The actual release will be determined by the state of the main branch at merge time.');
    
  } catch (error) {
    console.error('❌ Error analyzing release:', error);
    process.exit(1);
  }
}

// Run the main function
analyzeRelease().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
