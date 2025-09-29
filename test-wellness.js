// Test script to verify wellness functionality
const testWellnessService = async () => {
  console.log('Testing Wellness Fallback Service...');
  
  try {
    // Import the service
    const { wellnessFallback } = await import('./src/lib/wellnessFallback.ts');
    
    // Test cases
    const testMessages = [
      'Hello there!',
      'I feel so anxious today',
      'I can\'t sleep at night',
      'I feel depressed and hopeless',
      'I want to hurt myself',
      'Thank you for listening',
      'Good morning'
    ];
    
    console.log('\n--- Testing Pattern Matching ---');
    for (const message of testMessages) {
      const intent = wellnessFallback.analyzeUserIntent(message);
      const response = wellnessFallback.getContextualResponse(message);
      const enhanced = wellnessFallback.getEnhancedResponse(message);
      const isCrisis = wellnessFallback.isCrisisMessage(message);
      const shouldUseGemini = wellnessFallback.shouldUseGemini(message);
      
      console.log(`\nMessage: "${message}"`);
      console.log(`Intent: ${intent}`);
      console.log(`Crisis: ${isCrisis}`);
      console.log(`Use Gemini: ${shouldUseGemini}`);
      console.log(`Response: ${response.response.substring(0, 100)}...`);
      console.log(`Enhanced: ${enhanced.substring(0, 100)}...`);
      console.log('---');
    }
    
    // Test emergency resources
    console.log('\n--- Emergency Resources ---');
    const emergencyResources = wellnessFallback.getEmergencyResources();
    console.log(JSON.stringify(emergencyResources, null, 2));
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

testWellnessService();