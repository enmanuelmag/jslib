import { AuthResult } from "../models/domain/authResult";
import {
  ApiLogInCredentials,
  PasswordLogInCredentials,
  SsoLogInCredentials,
} from "../models/domain/logInCredentials";
import { SymmetricCryptoKey } from "../models/domain/symmetricCryptoKey";

import { TokenRequestTwoFactor } from "../models/request/identityToken/tokenRequest";

export abstract class AuthService {
  masterPasswordHash: string;
  email: string;
  logIn: (
    credentials: ApiLogInCredentials | PasswordLogInCredentials | SsoLogInCredentials
  ) => Promise<AuthResult>;
  logInTwoFactor: (twoFactor: TokenRequestTwoFactor) => Promise<AuthResult>;
  logOut: (callback: Function) => void;
  makePreloginKey: (masterPassword: string, email: string) => Promise<SymmetricCryptoKey>;
  authingWithApiKey: () => boolean;
  authingWithSso: () => boolean;
  authingWithPassword: () => boolean;
}
