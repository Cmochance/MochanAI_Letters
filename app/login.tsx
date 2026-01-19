import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function LoginScreen() {
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      Alert.alert("提示", "请输入有效邮箱");
      return;
    }
    if (password.length < 8) {
      Alert.alert("提示", "密码至少 8 位");
      return;
    }
    try {
      setSubmitting(true);
      const result = await Api.loginWithPassword({ email: normalizedEmail, password });
      if (Platform.OS !== "web") {
        await Auth.setSessionToken(result.sessionToken);
      }
      if (result.user) {
        await Auth.setUserInfo({
          id: result.user.id,
          openId: result.user.openId,
          name: result.user.name ?? null,
          email: result.user.email ?? null,
          loginMethod: result.user.loginMethod ?? null,
          lastSignedIn: new Date(result.user.lastSignedIn || Date.now()),
        });
      }
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("登录失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer className="p-4 justify-center">
      <View className="max-w-md w-full self-center">
        <Text className="text-3xl font-bold text-foreground font-title">登录</Text>
        <Text className="mt-2 text-muted">使用邮箱和密码登录</Text>

        <View className="mt-6 gap-3">
          <TextInput
            className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
            value={email}
            onChangeText={setEmail}
            placeholder="邮箱"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!submitting}
          />
          <TextInput
            className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
            value={password}
            onChangeText={setPassword}
            placeholder="密码（至少 8 位）"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            editable={!submitting}
            onSubmitEditing={onLogin}
            returnKeyType="done"
          />
        </View>

        <View className="mt-6 gap-3">
          <TouchableOpacity
            className="bg-primary py-4 rounded-full items-center active:opacity-80"
            onPress={onLogin}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-background font-semibold text-lg">登录</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="border border-border py-4 rounded-full items-center active:opacity-70"
            onPress={() => router.push("/register" as any)}
            disabled={submitting}
          >
            <Text className="text-foreground font-semibold text-lg">注册</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
