import { LogInStrategy } from "./logIn.strategy";

import { PasswordTokenRequest } from "../../models/request/identityToken/passwordTokenRequest";

import { ApiService } from "../../abstractions/api.service";
import { AppIdService } from "../../abstractions/appId.service";
import { AuthService } from "../../abstractions/auth.service";
import { CryptoService } from "../../abstractions/crypto.service";
import { LogService } from "../../abstractions/log.service";
import { MessagingService } from "../../abstractions/messaging.service";
import { PlatformUtilsService } from "../../abstractions/platformUtils.service";
import { StateService } from "../../abstractions/state.service";
import { TokenService } from "../../abstractions/token.service";
import { TwoFactorService } from "../../abstractions/twoFactor.service";

import { PasswordLogInCredentials } from "../../models/domain/logInCredentials";
import { SymmetricCryptoKey } from "../../models/domain/symmetricCryptoKey";

import { HashPurpose } from "../../enums/hashPurpose";

export class PasswordLogInStrategy extends LogInStrategy {
  get email() {
    return this.tokenRequest.email;
  }

  get masterPasswordHash() {
    return this.tokenRequest.masterPasswordHash;
  }

  tokenRequest: PasswordTokenRequest;

  private localHashedPassword: string;
  private key: SymmetricCryptoKey;

  constructor(
    cryptoService: CryptoService,
    apiService: ApiService,
    tokenService: TokenService,
    appIdService: AppIdService,
    platformUtilsService: PlatformUtilsService,
    messagingService: MessagingService,
    logService: LogService,
    stateService: StateService,
    twoFactorService: TwoFactorService,
    private authService: AuthService
  ) {
    super(
      cryptoService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      stateService,
      twoFactorService
    );
  }

  async onSuccessfulLogin() {
    await this.cryptoService.setKey(this.key);
    await this.cryptoService.setKeyHash(this.localHashedPassword);
  }

  async logIn(credentials: PasswordLogInCredentials) {
    const { email, masterPassword, captchaToken, twoFactor } = credentials;

    this.key = await this.authService.makePreloginKey(masterPassword, email);

    // Hash the password early (before authentication) so we don't persist it in memory in plaintext
    this.localHashedPassword = await this.cryptoService.hashPassword(
      masterPassword,
      this.key,
      HashPurpose.LocalAuthorization
    );
    const hashedPassword = await this.cryptoService.hashPassword(masterPassword, this.key);

    this.tokenRequest = new PasswordTokenRequest(
      email,
      hashedPassword,
      captchaToken,
      await this.buildTwoFactor(twoFactor),
      await this.buildDeviceRequest()
    );

    return this.startLogIn();
  }
}
