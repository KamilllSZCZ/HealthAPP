import React from "react";
import { ScrollView } from "react-native";

export function KAScroll(props: any) {
  const { bottomOffset, ...rest } = props;
  return <ScrollView {...rest} />;
}
