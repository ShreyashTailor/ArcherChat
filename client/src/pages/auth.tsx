import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Lock, User, UserPlus, Copy, Check, AlertTriangle, KeyRound, Key, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { generateKeyPair, saveKeysToStorage, getKeysFromStorage } from "@/lib/crypto";
import { createRecoveryInfo, decryptPrivateKeyWithPassphrase, validatePassphrase } from "@/lib/recovery-crypto";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = loginSchema.extend({
  displayName: z.string().min(1, "Display name is required"),
});

const recoverySchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  passphrase: z.string().min(1, "Recovery passphrase is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type RecoveryForm = z.infer<typeof recoverySchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [confirmWritten, setConfirmWritten] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string>("");
  const { toast } = useToast();
  const { login } = useAuth();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", password: "", displayName: "" },
  });

  const watchedUsername = registerForm.watch("username");

  useEffect(() => {
    if (mode !== "register" || !watchedUsername || watchedUsername.length < 3) {
      setUsernameAvailable(null);
      setUsernameError("");
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const response = await fetch(`/api/auth/check-username/${encodeURIComponent(watchedUsername)}`);
        const data = await response.json();
        
        if (data.available) {
          setUsernameAvailable(true);
          setUsernameError("");
        } else {
          setUsernameAvailable(false);
          setUsernameError(data.reason || "Username is not available");
        }
      } catch (error) {
        setUsernameAvailable(null);
        setUsernameError("");
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [watchedUsername, mode]);

  const recoveryForm = useForm<RecoveryForm>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { username: "", passphrase: "", newPassword: "" },
  });

  const onLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await apiRequest<{ user: any; token: string }>(
        "POST",
        "/api/auth/login",
        data
      );

      const keys = getKeysFromStorage(response.user.username);
      
      if (!keys) {
        toast({
          title: "Login failed",
          description: "Encryption keys not found. Please register a new account.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      login(response.user, response.token, keys);
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    if (!usernameAvailable) {
      toast({
        title: "Cannot create account",
        description: usernameError || "Username is not available",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const keys = await generateKeyPair();
      const recoveryInfo = await createRecoveryInfo(keys.privateKey);

      setRecoveryPassphrase(recoveryInfo.passphrase);
      setRegistrationData({
        ...data,
        keys,
        encryptedPrivateKey: recoveryInfo.encryptedPrivateKey,
      });
      setShowPassphrase(true);
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Failed to generate recovery keys",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const completeRegistration = async () => {
    if (!confirmWritten || !registrationData) return;

    setIsLoading(true);
    try {
      const response = await apiRequest<{ user: any; token: string }>(
        "POST",
        "/api/auth/register",
        {
          username: registrationData.username,
          password: registrationData.password,
          displayName: registrationData.displayName,
          publicKey: registrationData.keys.publicKey,
          encryptedPrivateKey: registrationData.encryptedPrivateKey,
        }
      );

      saveKeysToStorage(registrationData.username, registrationData.keys);
      login(response.user, response.token, registrationData.keys);
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Username already exists",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onRecover = async (data: RecoveryForm) => {
    setIsLoading(true);
    try {
      if (!validatePassphrase(data.passphrase)) {
        toast({
          title: "Invalid passphrase",
          description: "Please enter a valid 12-word recovery passphrase",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const response = await apiRequest<{ 
        encryptedPrivateKey: string;
        user: any;
        token: string;
      }>(
        "POST",
        "/api/auth/recover",
        { 
          username: data.username,
          newPassword: data.newPassword
        }
      );

      const privateKey = await decryptPrivateKeyWithPassphrase(
        response.encryptedPrivateKey,
        data.passphrase
      );

      const keys = { privateKey, publicKey: response.user.publicKey };
      saveKeysToStorage(data.username, keys);
      login(response.user, response.token, keys);
      
      toast({
        title: "Account recovered successfully",
        description: "Your encryption keys and password have been restored",
      });
      
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Recovery failed",
        description: error.message || "Unable to recover account. Please check your username and passphrase.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyPassphrase = () => {
    navigator.clipboard.writeText(recoveryPassphrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: "Make sure to write it down on paper as well",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {showPassphrase ? (
          <Card>
            <CardHeader className="space-y-1 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-lg bg-destructive flex items-center justify-center">
                  <KeyRound className="h-6 w-6 text-destructive-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Recovery Passphrase</CardTitle>
              <CardDescription>
                Write this down on paper and keep it safe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-destructive/10 border-2 border-destructive rounded-md">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-destructive space-y-1">
                    <p className="font-semibold">Critical: This is your only way to recover access</p>
                    <p>If you forget your password, this passphrase is the ONLY way to recover your encryption keys and messages.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-muted rounded-md border-2 border-border">
                  <p className="text-sm font-mono text-foreground break-words leading-relaxed">
                    {recoveryPassphrase}
                  </p>
                </div>

                <Button
                  onClick={copyPassphrase}
                  variant="outline"
                  className="w-full"
                  data-testid="button-copy-passphrase"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
                <Checkbox
                  id="confirm-written"
                  data-testid="checkbox-confirm"
                  checked={confirmWritten}
                  onCheckedChange={(checked) => setConfirmWritten(checked as boolean)}
                />
                <label
                  htmlFor="confirm-written"
                  className="text-sm text-foreground leading-tight cursor-pointer select-none"
                >
                  I have written down my recovery passphrase on paper and stored it in a safe place
                </label>
              </div>

              <Button
                onClick={completeRegistration}
                className="w-full h-12"
                disabled={!confirmWritten || isLoading}
                data-testid="button-complete-registration"
              >
                {isLoading ? "Creating account..." : "Continue"}
              </Button>

              <Button
                onClick={() => {
                  setShowPassphrase(false);
                  setConfirmWritten(false);
                  setCopied(false);
                }}
                variant="ghost"
                className="w-full"
                data-testid="button-back"
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="space-y-1 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
                  <Lock className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Archer</CardTitle>
              <CardDescription>
                {mode === "register"
                  ? "Create your encrypted account"
                  : mode === "recover"
                  ? "Recover your account"
                  : "Sign in to your encrypted chats"}
              </CardDescription>
            </CardHeader>
            <CardContent>
            {mode === "register" ? (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">Username</Label>
                  <div className="relative">
                    <Input
                      id="register-username"
                      data-testid="input-username"
                      placeholder="johndoe"
                      {...registerForm.register("username")}
                      className="h-12 pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUsername && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {!checkingUsername && usernameAvailable === true && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" data-testid="icon-username-available" />
                      )}
                      {!checkingUsername && usernameAvailable === false && (
                        <XCircle className="h-4 w-4 text-destructive" data-testid="icon-username-unavailable" />
                      )}
                    </div>
                  </div>
                  {registerForm.formState.errors.username && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.username.message}
                    </p>
                  )}
                  {!registerForm.formState.errors.username && usernameError && (
                    <p className="text-sm text-destructive" data-testid="text-username-error">
                      {usernameError}
                    </p>
                  )}
                  {!registerForm.formState.errors.username && usernameAvailable === true && (
                    <p className="text-sm text-green-500" data-testid="text-username-available">
                      Username is available
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-displayName">Display Name</Label>
                  <Input
                    id="register-displayName"
                    data-testid="input-displayname"
                    placeholder="John Doe"
                    {...registerForm.register("displayName")}
                    className="h-12"
                  />
                  {registerForm.formState.errors.displayName && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.displayName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    data-testid="input-password"
                    type="password"
                    placeholder="••••••••"
                    {...registerForm.register("password")}
                    className="h-12"
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  data-testid="button-register"
                  className="w-full h-12"
                  disabled={isLoading || checkingUsername || !usernameAvailable}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            ) : mode === "recover" ? (
              <form onSubmit={recoveryForm.handleSubmit(onRecover)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recover-username">Username</Label>
                  <Input
                    id="recover-username"
                    data-testid="input-username"
                    placeholder="johndoe"
                    {...recoveryForm.register("username")}
                    className="h-12"
                  />
                  {recoveryForm.formState.errors.username && (
                    <p className="text-sm text-destructive">
                      {recoveryForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recover-passphrase">Recovery Passphrase</Label>
                  <Textarea
                    id="recover-passphrase"
                    data-testid="input-passphrase"
                    placeholder="Enter your 12-word recovery passphrase"
                    {...recoveryForm.register("passphrase")}
                    className="min-h-[100px] font-mono text-sm"
                  />
                  {recoveryForm.formState.errors.passphrase && (
                    <p className="text-sm text-destructive">
                      {recoveryForm.formState.errors.passphrase.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recover-newPassword">New Password</Label>
                  <Input
                    id="recover-newPassword"
                    data-testid="input-new-password"
                    type="password"
                    placeholder="••••••••"
                    {...recoveryForm.register("newPassword")}
                    className="h-12"
                  />
                  {recoveryForm.formState.errors.newPassword && (
                    <p className="text-sm text-destructive">
                      {recoveryForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  data-testid="button-recover"
                  className="w-full h-12"
                  disabled={isLoading}
                >
                  <Key className="h-4 w-4 mr-2" />
                  {isLoading ? "Recovering account..." : "Recover Account"}
                </Button>
              </form>
            ) : (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    data-testid="input-username"
                    placeholder="johndoe"
                    {...loginForm.register("username")}
                    className="h-12"
                  />
                  {loginForm.formState.errors.username && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    data-testid="input-password"
                    type="password"
                    placeholder="••••••••"
                    {...loginForm.register("password")}
                    className="h-12"
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  data-testid="button-login"
                  className="w-full h-12"
                  disabled={isLoading}
                >
                  <User className="h-4 w-4 mr-2" />
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            )}

            <div className="mt-6 space-y-2 text-center">
              {mode === "login" ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    data-testid="button-toggle-register"
                    onClick={() => setMode("register")}
                    className="text-sm w-full"
                  >
                    Don't have an account? Register
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    data-testid="button-toggle-recover"
                    onClick={() => setMode("recover")}
                    className="text-sm w-full"
                  >
                    Forgot password? Recover account
                  </Button>
                </>
              ) : mode === "register" ? (
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="button-toggle-login"
                  onClick={() => setMode("login")}
                  className="text-sm w-full"
                >
                  Already have an account? Sign in
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="button-toggle-login"
                  onClick={() => setMode("login")}
                  className="text-sm w-full"
                >
                  Back to sign in
                </Button>
              )}
            </div>

            <div className="mt-6 p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground text-center">
                <Lock className="h-3 w-3 inline mr-1" />
                End-to-end encrypted. Your keys never leave your device.
              </p>
            </div>
          </CardContent>
        </Card>
        )}
      </motion.div>
    </div>
  );
}
