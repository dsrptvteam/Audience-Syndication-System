#!/usr/bin/env node
/**
 * Test script to verify phone normalization with country code
 * Run with: node test-phone-normalization.js
 */

// Simple normalizePhone implementation for testing
function normalizePhone(phone, defaultCountryCode = '1') {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '')

  // Handle invalid/incomplete numbers
  if (digitsOnly.length < 7) {
    return null // Too short to be a valid phone number
  }

  // If number already has country code (11+ digits), keep as-is
  if (digitsOnly.length >= 11) {
    return digitsOnly
  }

  // If number is exactly 10 digits, prepend country code
  if (digitsOnly.length === 10) {
    return defaultCountryCode + digitsOnly
  }

  // For 7-9 digit numbers, prepend country code
  return defaultCountryCode + digitsOnly
}

// Test cases
const testCases = [
  { input: '(202) 555-1234', expected: '12025551234', description: 'Standard US format with parentheses' },
  { input: '2025551234', expected: '12025551234', description: '10 digits without formatting' },
  { input: '+1 202 555 1234', expected: '12025551234', description: 'Already has +1 country code' },
  { input: '12025551234', expected: '12025551234', description: 'Already has 1 country code (11 digits)' },
  { input: '555-1234', expected: '15551234', description: 'Local number (7 digits, gets country code)' },
  { input: '202-555-1234', expected: '12025551234', description: 'Standard dash format' },
  { input: '1-202-555-1234', expected: '12025551234', description: 'With leading 1 and dashes' },
  { input: '44 20 7123 4567', expected: '442071234567', description: 'UK number (12 digits, keeps as-is)' },
  { input: '(555) 123', expected: null, description: 'Incomplete number (6 digits)' },
  { input: '800-555-1234', expected: '18005551234', description: 'Toll-free number' },
]

console.log('Testing phone normalization with country code...\n')

let passed = 0
let failed = 0

testCases.forEach((test, index) => {
  const result = normalizePhone(test.input)
  const success = result === test.expected

  if (success) {
    passed++
    console.log(`✓ Test ${index + 1}: ${test.description}`)
    console.log(`  Input: "${test.input}" → Output: "${result}"`)
  } else {
    failed++
    console.log(`✗ Test ${index + 1}: ${test.description}`)
    console.log(`  Input: "${test.input}"`)
    console.log(`  Expected: ${test.expected}`)
    console.log(`  Got: ${result}`)
  }
  console.log()
})

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`)

if (failed > 0) {
  process.exit(1)
} else {
  console.log('\n✓ All tests passed!')
  process.exit(0)
}
