// Optional email sign-in (spec 005): email -> 6-digit code, with a one-tap Skip at every step.
// All decisions live in services/auth/flow.ts; this screen renders the state and performs the IO each
// transition asks for. Nothing here gates a feature — dismissing it leaves the app fully usable.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { Button } from '../src/components/common/Button';
import { getAuthService } from '../src/features/auth/authService';
import {
  FlowEvent,
  FlowState,
  initialFlow,
  isSixDigits,
  reduce,
  resendSecondsLeft,
} from '../src/services/auth/flow';
import { describeError } from '../src/services/auth/messages';
import type { AuthError } from '../src/services/auth/client';
import { colors, font, radius, textAlpha } from '../src/theme/nocturne';

export default function SignIn() {
  const router = useRouter();
  const service = getAuthService();
  const [flow, setFlow] = useState<FlowState>(initialFlow());
  const [emailText, setEmailText] = useState('');
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const handled = useRef<FlowState | null>(null);

  const dispatch = useCallback(
    (event: FlowEvent) => setFlow((s) => reduce(s, event, Date.now())),
    [],
  );

  // Show the offer once: opening this screen counts as having seen it, however it ends.
  useEffect(() => {
    void service.markOfferSeen();
    void service.lastEmail().then((last) => {
      if (last) setEmailText((current) => current || last);
    });
  }, [service]);

  // Perform the IO of the current step exactly once per state object.
  useEffect(() => {
    if (handled.current === flow) return;
    handled.current = flow;
    if (flow.step === 'requesting') {
      void service
        .requestCode(flow.email)
        .then((result) => dispatch({ type: 'request_done', result }));
    } else if (flow.step === 'verifying') {
      void service
        .verify(flow.email, code)
        .then((result) => dispatch({ type: 'verify_done', result }));
    } else if (flow.step === 'done' || flow.step === 'dismissed') {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  }, [flow, code, service, dispatch, router]);

  // One tick per second while a countdown matters; announced to screen readers only at its ends.
  const inCodeStep = flow.step === 'code';
  useEffect(() => {
    if (!inCodeStep) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inCodeStep]);

  const secondsLeft = resendSecondsLeft(flow, now);
  const canResend = inCodeStep && secondsLeft === 0;
  const prevCanResend = useRef(false);
  useEffect(() => {
    if (canResend && !prevCanResend.current && flow.step === 'code') {
      AccessibilityInfo.announceForAccessibility('You can ask for a new code now.');
    }
    prevCanResend.current = canResend;
  }, [canResend, flow.step]);
  useEffect(() => {
    if (flow.step === 'code' && !flow.error) {
      AccessibilityInfo.announceForAccessibility(
        `Code sent to ${flow.email}. Check your inbox and spam folder.`,
      );
    }
  }, [inCodeStep]);

  const busy = flow.step === 'requesting' || flow.step === 'verifying';
  const codeStep =
    flow.step === 'code'
      ? flow
      : flow.step === 'verifying' || flow.step === 'requesting'
        ? flow.previous
        : undefined;
  const error: AuthError | undefined =
    flow.step === 'email' || flow.step === 'code' ? flow.error : undefined;

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Kicker>Sign in</Kicker>
        <Text style={styles.title} accessibilityRole="header">
          {codeStep ? 'Enter your code' : 'Sign in with email'}
        </Text>
        <Text style={styles.blurb}>
          {codeStep
            ? `We sent a 6-digit code to ${codeStep.email}. It works for 10 minutes. Not there? Check spam.`
            : 'Sign in so we can reach out about your feedback. Practice works without it.'}
        </Text>

        {!codeStep ? (
          <>
            <TextInput
              style={styles.input}
              value={emailText}
              onChangeText={setEmailText}
              placeholder="you@example.com"
              placeholderTextColor={textAlpha[45]}
              accessibilityLabel="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!busy}
              returnKeyType="send"
              onSubmitEditing={() => dispatch({ type: 'submit_email', email: emailText })}
            />
            <ErrorNote error={error} />
            <Button
              label={flow.step === 'requesting' ? 'Sending…' : 'Send code'}
              disabled={busy || emailText.trim().length === 0}
              onPress={() => dispatch({ type: 'submit_email', email: emailText })}
              style={styles.cta}
            />
          </>
        ) : (
          <>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={textAlpha[45]}
              accessibilityLabel="6-digit code"
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              editable={!busy && !codeStep.needsNewCode}
              onSubmitEditing={() => dispatch({ type: 'submit_code', code })}
            />
            <ErrorNote error={error} />
            {codeStep.needsNewCode ? (
              <Button
                label={canResend ? 'Send a new code' : `Send a new code in ${secondsLeft}s`}
                disabled={busy || !canResend}
                onPress={() => dispatch({ type: 'resend' })}
                style={styles.cta}
              />
            ) : (
              <>
                <Button
                  label={flow.step === 'verifying' ? 'Checking…' : 'Sign in'}
                  disabled={busy || !isSixDigits(code)}
                  onPress={() => dispatch({ type: 'submit_code', code })}
                  style={styles.cta}
                />
                <Button
                  label={canResend ? 'Send again' : `Send again in ${secondsLeft}s`}
                  variant="secondary"
                  disabled={busy || !canResend}
                  onPress={() => dispatch({ type: 'resend' })}
                  style={styles.second}
                />
              </>
            )}
            <Button
              label="Use a different email"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setCode('');
                dispatch({ type: 'change_email' });
              }}
              style={styles.link}
            />
          </>
        )}

        <View style={styles.spacer} />
        <Button
          label="Skip for now"
          variant="ghost"
          onPress={() => dispatch({ type: 'skip' })}
          style={styles.link}
        />
      </ScrollView>
    </Screen>
  );
}

function ErrorNote({ error }: { error?: AuthError }) {
  if (!error) return null;
  const { title, hint } = describeError(error);
  return (
    <View
      style={styles.error}
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`${title}. ${hint}`}
    >
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1 },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: font.weightHeading,
    marginTop: 6,
    marginBottom: 10,
  },
  blurb: { color: textAlpha[65], fontSize: 14, lineHeight: 22, marginBottom: 22 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
  },
  codeInput: { fontSize: 24, letterSpacing: 6, textAlign: 'center' },
  error: { marginTop: 12, gap: 2 },
  errorTitle: { color: colors.warm, fontSize: 14, fontWeight: font.weightSemibold },
  errorHint: { color: textAlpha[70], fontSize: 13, lineHeight: 19 },
  cta: { marginTop: 18, minHeight: 52 },
  second: { marginTop: 10 },
  link: { marginTop: 10, minHeight: 48, alignSelf: 'center' },
  spacer: { flex: 1, minHeight: 24 },
});
