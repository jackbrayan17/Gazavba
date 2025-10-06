import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';

export default function OTPVerification({ navigation, route }: any){
  const [otp, setOtp] = useState('');
  // In static demo, accept any code
  return (
    <View style={{flex:1,justifyContent:'center',padding:20}}>
      <Text>OTP sent to {route.params.phone}</Text>
      <TextInput value={otp} onChangeText={setOtp} placeholder="Enter OTP" keyboardType="number-pad" style={{borderWidth:1,padding:12,marginTop:12}}/>
      <Button title="Verify" onPress={() => navigation.replace('ProfileSetup', { phone: route.params.phone })}/>
    </View>
  );
}
