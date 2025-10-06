import React from 'react';
import { View, FlatList, Text, TouchableOpacity } from 'react-native';
import { chats } from '../data/mockData';

export default function ChatsScreen({ navigation }: any) {
  return (
    <View style={{flex:1}}>
      <FlatList data={chats} keyExtractor={i=>i.id} renderItem={({item}) => (
        <TouchableOpacity onPress={()=>navigation.navigate('ChatScreen',{chatId:item.id})} style={{padding:16,borderBottomWidth:1,borderColor:'#eee'}}>
          <Text style={{fontWeight:'700'}}>{item.name}</Text>
          <Text>{item.lastMessage}</Text>
        </TouchableOpacity>
      )} />
    </View>
  );
}
