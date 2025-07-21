import { runMainAgent } from './agents/mainAgent';
import dotenv from 'dotenv';

dotenv.config();

async function testAgent() {
  try {
    console.log('Testing Deana Agent...');

    // Mock credentials (you'll need real ones for actual testing)
    const mockCreds = {
      access_token: 'mock_token',
      refresh_token: 'mock_refresh_token',
    };

    // Test simple query
    const result = await runMainAgent(
      'What meetings do I have tomorrow?',
      mockCreds,
      { history: [] }
    );

    console.log('Agent Result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAgent();
