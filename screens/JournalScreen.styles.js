// --- PantryScreen.styles.js (Final beautiful PocketChef style) ---

import { StyleSheet, Dimensions } from 'react-native';

export const COLORS = {
  primary: '#0A4B4C',
  secondary: '#9FD5CD',
  background: '#F7F9FC',
  surface: '#FFFFFF',
  error: '#FF3B30',
  text: '#2D3436',
  textSecondary: '#636E72',
  border: '#DFE6E9',
  success: '#00B894',
  warning: '#FDCB6E',
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    paddingHorizontal: 20,
    fontSize: 16,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  categoryScroll: {
    marginVertical: 12,
    paddingLeft: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,                  // ✅ FIXED HEIGHT for all buttons
    minWidth: 80,                // ✅ MINIMUM WIDTH so All, Protein, etc. look even
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedCategoryButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 14,
    color: COLORS.text,
  },
  selectedCategoryText: {
    fontSize: 14,
    color: COLORS.surface,
    fontWeight: '600',
  },
  
  itemsList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    marginTop: 12,  
  },
  itemCard: {
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemImageEmoji: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  itemAmount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.surface,
    fontSize: 20,
    fontWeight: '600',
  },
});

export default styles;
