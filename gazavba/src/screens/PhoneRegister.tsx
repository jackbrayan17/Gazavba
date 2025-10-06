import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';

export default function PhoneRegister({ navigation }: any) {
  const [phone, setPhone] = useState('');
  return (
    <View style={{ flex:1, justifyContent:'center', padding:20 }}>
      <Text style={{fontSize:20,fontWeight:'700'}}>Enter your phone number</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+237 6XX XXX XXX"
        style={{borderWidth:1,borderRadius:8,padding:12,marginTop:12}}
      />
      <Button title="Send OTP (simulated)" onPress={() => navigation.navigate('OTPVerification', { phone })} />
    </View>
  );
}
