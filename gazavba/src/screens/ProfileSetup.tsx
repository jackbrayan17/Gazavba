import React, { useState } from 'react';
import { View, TextInput, Button, Image, TouchableOpacity, Text, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileSetup({ navigation, route }: any) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'We need access to your photos to select a profile picture.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!res.canceled && res.assets && res.assets.length > 0) {
      setAvatar(res.assets[0].uri);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
        Choose a name & avatar
      </Text>

      <TouchableOpacity onPress={pickImage} style={{ marginTop: 20, alignItems: 'center' }}>
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={{ width: 100, height: 100, borderRadius: 50 }}
          />
        ) : (
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: '#ddd',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text>Add</Text>
          </View>
        )}
      </TouchableOpacity>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 12,
          marginTop: 20,
          borderRadius: 8,
        }}
      />

      <Button
        title="Continue"
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'Chats',
                params: { user: { name, avatar, phone: route.params.phone } },
              },
            ],
          })
        }
      />
    </View>
  );
}
