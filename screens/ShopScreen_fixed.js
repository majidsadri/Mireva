  const addItem = async (itemData = null) => {
    console.log('=== ADD ITEM FUNCTION CALLED ===');
    console.log('newItemText raw value:', JSON.stringify(newItemText));
    console.log('itemData:', itemData);
    
    const itemName = itemData ? itemData.name : newItemText.trim();
    console.log('Final item name:', JSON.stringify(itemName));
    console.log('itemName length:', itemName.length);
    console.log('itemName truthy:', !!itemName);
    
    if (!itemName || itemName.length === 0) {
      console.log('No item name provided, returning early');
      Alert.alert('Error', `Please enter an item name. Current text: "${newItemText}"`);
      return;
    }
    
    const newItem = {
      name: itemName,
      category: itemData ? itemData.category : getCategoryForItem(itemName),
      completed: false,
      reason: itemData ? itemData.reason : 'Manually added',
      priority: itemData ? itemData.priority : 'medium'
    };

    try {
      setAddingItem(true);
      const headers = await getUserHeaders();
      
      console.log('Adding item:', newItem);
      console.log('Headers:', headers);
      console.log('URL:', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHOPPING_LIST}`);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHOPPING_LIST}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ item: newItem }),
      });
      
      console.log('Response status:', response.status);
      const responseData = await response.text();
      console.log('Response data:', responseData);
      
      if (response.ok) {
        console.log('Item added successfully, reloading list...');
        if (!itemData) setNewItemText(''); // Only clear input for manual adds
        
        // Force immediate reload of the shopping list
        setTimeout(async () => {
          await loadShoppingList();
          Alert.alert('Success', 'Item added to shopping list!');
        }, 100);
      } else {
        console.error('Failed to add item, response:', responseData);
        throw new Error(`Failed to add item: ${response.status} ${responseData}`);
      }
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', `Failed to add item to shopping list: ${error.message}`);
    } finally {
      setAddingItem(false);
    }
  };