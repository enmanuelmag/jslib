import { KdfType } from "../enums/kdfType";

import { ApiLogInStrategy } from "../misc/logInStrategies/apiLogin.strategy";
import { PasswordLogInStrategy } from "../misc/logInStrategies/passwordLogin.strategy";
import { SsoLogInStrategy } from "../misc/logInStrategies/ssoLogin.strategy";
import { AuthResult } from "../models/domain/authResult";
import {
  ApiLogInCredentials,
  PasswordLogInCredentials,
  SsoLogInCredentials,
} from "../models/domain/logInCredentials";
import { SymmetricCryptoKey } from "../models/domain/symmetricCryptoKey";

import { PreloginRequest } from "../models/request/preloginRequest";

import { TokenRequestTwoFactor } from "../models/request/identityToken/tokenRequest";

import { ApiService } from "../abstractions/api.service";
import { AppIdService } from "../abstractions/appId.service";
import { AuthService as AuthServiceAbstraction } from "../abstractions/auth.service";
import { CryptoService } from "../abstractions/crypto.service";
import { EnvironmentService } from "../abstractions/environment.service";
import { KeyConnectorService } from "../abstractions/keyConnector.service";
import { LogService } from "../abstractions/log.service";
import { MessagingService } from "../abstractions/messaging.service";
import { PlatformUtilsService } from "../abstractions/platformUtils.service";
import { StateService } from "../abstractions/state.service";
import { TokenService } from "../abstractions/token.service";
import { TwoFactorService } from "../abstractions/twoFactor.service";

import { AuthenticationType } from "../enums/authenticationType";

export class AuthService implements AuthServiceAbstraction {
  get email(): string {
    return this.logInStrategy instanceof PasswordLogInStrategy ? this.logInStrategy.email : null;
  }

  get masterPasswordHash(): string {
    return this.logInStrategy instanceof PasswordLogInStrategy
      ? this.logInStrategy.masterPasswordHash
      : null;
  }

  private logInStrategy: ApiLogInStrategy | PasswordLogInStrategy | SsoLogInStrategy;

  constructor(
    protected cryptoService: CryptoService,
    protected apiService: ApiService,
    protected tokenService: TokenService,
    protected appIdService: AppIdService,
    protected platformUtilsService: PlatformUtilsService,
    protected messagingService: MessagingService,
    protected logService: LogService,
    protected keyConnectorService: KeyConnectorService,
    protected environmentService: EnvironmentService,
    protected stateService: StateService,
    protected twoFactorService: TwoFactorService
  ) {}

  async logIn(
    credentials: ApiLogInCredentials | PasswordLogInCredentials | SsoLogInCredentials
  ): Promise<AuthResult> {
    this.clearState();

    let strategy: ApiLogInStrategy | PasswordLogInStrategy | SsoLogInStrategy;

    if (credentials.type === AuthenticationType.Password) {
      strategy = new PasswordLogInStrategy(
        this.cryptoService,
        this.apiService,
        this.tokenService,
        this.appIdService,
        this.platformUtilsService,
        this.messagingService,
        this.logService,
        this.stateService,
        this.twoFactorService,
        this
      );
    } else if (credentials.type === AuthenticationType.Sso) {
      strategy = new SsoLogInStrategy(
        this.cryptoService,
        this.apiService,
        this.tokenService,
        this.appIdService,
        this.platformUtilsService,
        this.messagingService,
        this.logService,
        this.stateService,
        this.twoFactorService,
        this.keyConnectorService
      );
    } else if (credentials.type === AuthenticationType.Api) {
      strategy = new ApiLogInStrategy(
        this.cryptoService,
        this.apiService,
        this.tokenService,
        this.appIdService,
        this.platformUtilsService,
        this.messagingService,
        this.logService,
        this.stateService,
        this.twoFactorService,
        this.environmentService,
        this.keyConnectorService
      );
    }

    const result = await strategy.logIn(credentials as any);

    if (result?.requiresTwoFactor) {
      this.saveState(strategy);
    }
    return result;
  }

  async logInTwoFactor(twoFactor: TokenRequestTwoFactor): Promise<AuthResult> {
    try {
      return await this.logInStrategy.logInTwoFactor(twoFactor);
    } finally {
      this.clearState();
    }
  }

  logOut(callback: Function) {
    callback();
    this.messagingService.send("loggedOut");
  }

  authingWithApiKey(): boolean {
    return this.logInStrategy instanceof ApiLogInStrategy;
  }

  authingWithSso(): boolean {
    return this.logInStrategy instanceof SsoLogInStrategy;
  }

  authingWithPassword(): boolean {
    return this.logInStrategy instanceof PasswordLogInStrategy;
  }

  async makePreloginKey(masterPassword: string, email: string): Promise<SymmetricCryptoKey> {
    email = email.trim().toLowerCase();
    let kdf: KdfType = null;
    let kdfIterations: number = null;
    try {
      const preloginResponse = await this.apiService.postPrelogin(new PreloginRequest(email));
      if (preloginResponse != null) {
        kdf = preloginResponse.kdf;
        kdfIterations = preloginResponse.kdfIterations;
      }
    } catch (e) {
      if (e == null || e.statusCode !== 404) {
        throw e;
      }
    }
    return this.cryptoService.makeKey(masterPassword, email, kdf, kdfIterations);
  }

  private saveState(strategy: ApiLogInStrategy | PasswordLogInStrategy | SsoLogInStrategy) {
    this.logInStrategy = strategy;
  }

  private clearState() {
    this.logInStrategy = null;
  }
}
