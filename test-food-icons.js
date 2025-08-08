// Quick test to verify food icon matching
import { getFoodIcon } from './utils/foodIcons.js';

// Test cases
const testItems = [
  'water',
  'watermelon', 
  'apple',
  'green apple',
  'chicken',
  'beef',
  'milk',
  'bread',
  'coffee',
  'unknown item'
];

console.log('Food Icon Test Results:');
console.log('=======================');

testItems.forEach(item => {
  const icon = getFoodIcon(item);
  console.log(`${item} → ${icon}`);
});

// Expected results:
// water → 💧 (not 🍉)
// watermelon → 🍉
// apple → 🍎
// green apple → 🍎
// chicken → 🐔
// beef → 🥩
// milk → 🥛
// bread → 🍞
// coffee → ☕
// unknown item → 🍽️