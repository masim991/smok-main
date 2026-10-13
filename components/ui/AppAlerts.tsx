import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { subscribeAlerts, dismissAppAlert, type AppAlert } from '@/utils/alerts';
export function AppAlerts() {
  const [alert, setAlert] = useState<AppAlert | null>(null); const { colors } = useTheme(); const { i18n } = useTranslation();
  useEffect(() => subscribeAlerts(setAlert), []);
  if (!alert) return null;
  const buttons = alert.buttons?.length ? alert.buttons : [{ text: i18n.language.startsWith('ko') ? '확인' : 'OK' }];
  return <Modal visible transparent animationType="fade" onRequestClose={() => { const cancel=buttons.find(b=>b.style==='cancel'); dismissAppAlert(); cancel?.onPress?.(); }}><View style={styles.backdrop}><View accessibilityViewIsModal style={[styles.dialog,{backgroundColor:colors.surface,borderColor:colors.border}]}><Text accessibilityRole="header" style={{fontSize:22,fontWeight:'700',color:colors.text}}>{alert.title}</Text>{!!alert.message && <Text style={{lineHeight:24,fontSize:16,color:colors.textSecondary,marginTop:16}}>{alert.message}</Text>}<View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-end',gap:12,marginTop:24}}>{buttons.map((button,index)=><TouchableOpacity key={index} accessibilityRole="button" style={{padding:14,minHeight:48,borderRadius:10,borderWidth:1,borderColor:colors.border}} onPress={()=>{dismissAppAlert();button.onPress?.();}}><Text style={{fontWeight:'700',color:button.style==='destructive'?colors.error:colors.primary}}>{button.text}</Text></TouchableOpacity>)}</View></View></View></Modal>;
}
const styles=StyleSheet.create({backdrop:{flex:1,backgroundColor:'rgba(15,23,42,0.5)',justifyContent:'center',alignItems:'center',padding:24},dialog:{width:'100%',maxWidth:460,padding:24,borderRadius:20,borderWidth:1}});
