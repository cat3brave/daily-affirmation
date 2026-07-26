import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SupabaseError = { message: string };
type AuthResult = { error: SupabaseError | null };
type PasswordCredentials = {
  email: string;
  password: string;
};
type OAuthCredentials = {
  provider: "google";
  options: {
    redirectTo: string;
  };
};
type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const loginMocks = vi.hoisted(() => {
  const push = vi.fn<(path: string) => void>();
  const useRouter = vi.fn(() => ({ push }));
  const signInWithPassword =
    vi.fn<(credentials: PasswordCredentials) => Promise<AuthResult>>();
  const signUp = vi.fn<(credentials: PasswordCredentials) => Promise<AuthResult>>();
  const signInWithOAuth =
    vi.fn<(credentials: OAuthCredentials) => Promise<AuthResult>>();
  const createSupabaseBrowserClient = vi.fn(() => ({
    auth: { signInWithOAuth, signInWithPassword, signUp },
  }));

  return {
    createSupabaseBrowserClient,
    push,
    signInWithOAuth,
    signInWithPassword,
    signUp,
    useRouter,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: loginMocks.useRouter,
}));

vi.mock("../lib/supabaseClient", () => ({
  createSupabaseBrowserClient: loginMocks.createSupabaseBrowserClient,
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

import LoginPage from "./page";

const EMAIL_PLACEHOLDER = "メールアドレス";
const PASSWORD_PLACEHOLDER = "パスワード";
const EMAIL_REQUIRED_MESSAGE = "メールアドレスを入力してください。";
const PASSWORD_REQUIRED_MESSAGE = "パスワードを入力してください。";
const LOGIN_FAILURE_MESSAGE =
  "ログインに失敗しました。メールアドレスとパスワードを確認してください。";
const SIGN_UP_FAILURE_MESSAGE =
  "登録に失敗しました。メールアドレスやパスワードを確認してください。";
const SIGN_UP_SUCCESS_MESSAGE =
  "確認メールを送信しました🌱 メール内のリンクを押してから、ログインしてください。";
const GOOGLE_LOGIN_FAILURE_MESSAGE =
  "Googleログインに失敗しました。もう一度お試しください。";
const LOGIN_BUTTON_LABEL = "ログイン";
const GOOGLE_LOGIN_BUTTON_LABEL = "Googleでログイン";
const SIGN_UP_TOGGLE_LABEL = "はじめての方はこちら（新規登録）";
const SIGN_UP_SUBMIT_LABEL = "確認メールを送る";

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>["resolve"] | undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  if (!resolve) {
    throw new Error("Deferred promise was not initialized.");
  }

  return { promise, resolve };
}

function configureLoginMock() {
  loginMocks.createSupabaseBrowserClient.mockReset();
  loginMocks.push.mockReset();
  loginMocks.signInWithOAuth.mockReset();
  loginMocks.signInWithPassword.mockReset();
  loginMocks.signUp.mockReset();
  loginMocks.useRouter.mockReset();

  loginMocks.useRouter.mockReturnValue({ push: loginMocks.push });
  loginMocks.createSupabaseBrowserClient.mockReturnValue({
    auth: {
      signInWithOAuth: loginMocks.signInWithOAuth,
      signInWithPassword: loginMocks.signInWithPassword,
      signUp: loginMocks.signUp,
    },
  });
  loginMocks.signInWithOAuth.mockResolvedValue({ error: null });
  loginMocks.signInWithPassword.mockResolvedValue({ error: null });
  loginMocks.signUp.mockResolvedValue({ error: null });
}

function fillEmailAndPassword(email = " user@example.com ", password = "secret") {
  fireEvent.change(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), {
    target: { value: password },
  });
}

function switchToSignUpMode() {
  fireEvent.click(
    screen.getByRole("button", {
      name: SIGN_UP_TOGGLE_LABEL,
    }),
  );
}

beforeEach(() => {
  configureLoginMock();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LoginPage", () => {
  it("メール未入力とパスワード未入力では認証通信せず入力エラーを表示する", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: LOGIN_BUTTON_LABEL }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      EMAIL_REQUIRED_MESSAGE,
    );
    expect(loginMocks.signInWithPassword).not.toHaveBeenCalled();
    expect(loginMocks.signUp).not.toHaveBeenCalled();
    expect(loginMocks.signInWithOAuth).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: LOGIN_BUTTON_LABEL }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      PASSWORD_REQUIRED_MESSAGE,
    );
    expect(loginMocks.signInWithPassword).not.toHaveBeenCalled();
    expect(loginMocks.signUp).not.toHaveBeenCalled();
    expect(loginMocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("ログイン成功時にtrimしたメールとパスワードを渡しdashboardへ遷移する", async () => {
    render(<LoginPage />);
    fillEmailAndPassword();

    fireEvent.click(screen.getByRole("button", { name: LOGIN_BUTTON_LABEL }));

    await screen.findByRole("button", { name: LOGIN_BUTTON_LABEL });
    expect(loginMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret",
    });
    expect(loginMocks.push).toHaveBeenCalledWith("/dashboard");
  });

  it("ログインがerrorを返した場合にエラー表示し遷移しない", async () => {
    loginMocks.signInWithPassword.mockResolvedValue({
      error: { message: "invalid credentials" },
    });
    render(<LoginPage />);
    fillEmailAndPassword();

    fireEvent.click(screen.getByRole("button", { name: LOGIN_BUTTON_LABEL }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOGIN_FAILURE_MESSAGE,
    );
    expect(loginMocks.push).not.toHaveBeenCalled();
  });

  it("ログインがthrowした場合に例外を伝播させずエラー表示して再操作可能に戻る", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("sign in exploded");
    loginMocks.signInWithPassword.mockRejectedValue(error);
    render(<LoginPage />);
    fillEmailAndPassword();

    let clickError: unknown;
    try {
      fireEvent.click(screen.getByRole("button", { name: LOGIN_BUTTON_LABEL }));
    } catch (caughtError) {
      clickError = caughtError;
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOGIN_FAILURE_MESSAGE,
    );
    expect(clickError).toBeUndefined();
    expect(screen.getByRole("button", { name: LOGIN_BUTTON_LABEL })).toBeEnabled();
    expect(loginMocks.push).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "ログイン中に想定外のエラー:",
      error,
    );
  });

  it("新規登録成功時に確認メール送信メッセージを表示しログインモードへ戻る", async () => {
    render(<LoginPage />);
    switchToSignUpMode();
    fillEmailAndPassword();

    fireEvent.click(screen.getByRole("button", { name: SIGN_UP_SUBMIT_LABEL }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      SIGN_UP_SUCCESS_MESSAGE,
    );
    expect(
      screen.getByRole("button", { name: LOGIN_BUTTON_LABEL }),
    ).toBeInTheDocument();
  });

  it("新規登録がerrorを返した場合にエラー表示する", async () => {
    loginMocks.signUp.mockResolvedValue({
      error: { message: "sign up failed" },
    });
    render(<LoginPage />);
    switchToSignUpMode();
    fillEmailAndPassword();

    fireEvent.click(screen.getByRole("button", { name: SIGN_UP_SUBMIT_LABEL }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      SIGN_UP_FAILURE_MESSAGE,
    );
  });

  it("新規登録がthrowした場合に例外を伝播させずエラー表示して再操作可能に戻る", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("sign up exploded");
    loginMocks.signUp.mockRejectedValue(error);
    render(<LoginPage />);
    switchToSignUpMode();
    fillEmailAndPassword();

    let clickError: unknown;
    try {
      fireEvent.click(screen.getByRole("button", { name: SIGN_UP_SUBMIT_LABEL }));
    } catch (caughtError) {
      clickError = caughtError;
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      SIGN_UP_FAILURE_MESSAGE,
    );
    expect(clickError).toBeUndefined();
    expect(
      screen.getByRole("button", { name: SIGN_UP_SUBMIT_LABEL }),
    ).toBeEnabled();
    expect(consoleError).toHaveBeenCalledWith("登録中に想定外のエラー:", error);
  });

  it("Googleログイン時にproviderと正しいredirectToを渡す", async () => {
    render(<LoginPage />);

    fireEvent.click(
      screen.getByRole("button", { name: GOOGLE_LOGIN_BUTTON_LABEL }),
    );

    expect(loginMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost/auth/callback",
      },
    });
  });

  it("Googleログインがerrorを返した場合にエラー表示して再操作可能に戻る", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = { message: "oauth failed" };
    loginMocks.signInWithOAuth.mockResolvedValue({ error });
    render(<LoginPage />);

    fireEvent.click(
      screen.getByRole("button", { name: GOOGLE_LOGIN_BUTTON_LABEL }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      GOOGLE_LOGIN_FAILURE_MESSAGE,
    );
    expect(
      screen.getByRole("button", { name: GOOGLE_LOGIN_BUTTON_LABEL }),
    ).toBeEnabled();
    expect(consoleError).toHaveBeenCalledWith("Googleログインエラー:", error.message);
  });

  it("Googleログインがthrowした場合に例外を伝播させずエラー表示して再操作可能に戻る", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("oauth exploded");
    loginMocks.signInWithOAuth.mockRejectedValue(error);
    render(<LoginPage />);

    let clickError: unknown;
    try {
      fireEvent.click(
        screen.getByRole("button", { name: GOOGLE_LOGIN_BUTTON_LABEL }),
      );
    } catch (caughtError) {
      clickError = caughtError;
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      GOOGLE_LOGIN_FAILURE_MESSAGE,
    );
    expect(clickError).toBeUndefined();
    expect(
      screen.getByRole("button", { name: GOOGLE_LOGIN_BUTTON_LABEL }),
    ).toBeEnabled();
    expect(consoleError).toHaveBeenCalledWith("Googleログインエラー:", error);
  });

  it("認証処理中は入力とボタンをdisabledにし連続操作でも通信を1回だけ実行する", async () => {
    const signInDeferred = createDeferred<AuthResult>();
    loginMocks.signInWithPassword.mockReturnValue(signInDeferred.promise);
    render(<LoginPage />);
    fillEmailAndPassword();
    const emailInput = screen.getByPlaceholderText(EMAIL_PLACEHOLDER);
    const passwordInput = screen.getByPlaceholderText(PASSWORD_PLACEHOLDER);
    const googleButton = screen.getByRole("button", {
      name: GOOGLE_LOGIN_BUTTON_LABEL,
    });
    const loginButton = screen.getByRole("button", { name: LOGIN_BUTTON_LABEL });

    fireEvent.click(loginButton);
    fireEvent.click(loginButton);
    fireEvent.click(googleButton);

    expect(loginMocks.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(loginMocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(loginButton).toBeDisabled();
    expect(googleButton).toBeDisabled();

    await act(async () => {
      signInDeferred.resolve({ error: null });
      await signInDeferred.promise;
    });

    expect(loginMocks.push).toHaveBeenCalledWith("/dashboard");
  });

  it("再レンダーしてもSupabaseクライアントを再作成しない", () => {
    const { rerender } = render(<LoginPage />);

    expect(loginMocks.createSupabaseBrowserClient).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText(EMAIL_PLACEHOLDER), {
      target: { value: "user@example.com" },
    });
    rerender(<LoginPage />);

    expect(loginMocks.createSupabaseBrowserClient).toHaveBeenCalledTimes(1);
  });
});
