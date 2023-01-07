/*
 * Created on Thu Jan 28 2021
 *
 * Copyright (c) storycraft. Licensed under the MIT Licence.
 */

import { Long } from 'bson';
import {
  WebClient,
  createWebClient,
  RequestForm,
  RequestHeader,
  DataWebRequest,
} from '@api/web-client';
import { DefaultConfiguration, OAuthLoginConfig } from '@src/config';
import { OAuthCredential } from '@src/oauth';
import {
  AsyncCommandResult,
  DefaultRes,
  KnownDataStatusCode,
} from '@src/request';
import { fillAHeader, fillBaseHeader, getUserAgent } from '@api/header-util';
import { AccessDataStruct, structToLoginData } from '@api/struct';
import { Win32XVCProvider, XVCProvider } from '@api/xvc';

/**
 * Login data
 */
export interface LoginData extends OAuthCredential {
  /**
   * User id
   */
  userId: Long;

  /**
   * Country iso
   */
  countryIso: string;

  /**
   * Country code
   */
  countryCode: string;

  /**
   * Account id
   */
  accountId: number;

  /**
   * Login server time
   */
  serverTime: number;

  /**
   * true if user data should be reset
   */
  resetUserData: boolean;

  /**
   * Story URL
   */
  storyURL: string;

  /**
   * OAuth token type
   */
  tokenType: string;

  /**
   * Auto login account id
   */
  autoLoginAccountId: string;

  /**
   * Displayed account id
   */
  displayAccountId: string;

  /**
   * Main device agent
   */
  mainDeviceAgentName: string;

  /**
   * Main device app version
   */
  mainDeviceAppVersion: string;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface TokenLoginForm extends LoginForm {
  autowithlock: boolean;
}

/**
 * Status code for auth client results
 */
export enum KnownAuthStatusCode {
  INVALID_PHONE_NUMBER = 1,
  SUCCESS_WITH_ACCOUNT = 10,
  SUCCESS_WITH_DEVICE_CHANGED = 11,
  MISMATCH_PASSWORD = 12,
  EXCEED_LOGIN_LIMIT = 13,
  MISMATCH_PHONE_NUMBER = 14,
  EXCEED_PHONE_NUMBER_CHECK_LIMIT = 15,
  NOT_EXIST_ACCOUNT = 16,
  NEED_CHECK_PHONE_NUMBER = 20,
  NEED_CHECK_QUIZ = 25,
  DORMANT_ACCOUNT = 26,
  RESTRICTED_ACCOUNT = 27,
  LOGIN_FAILED = 30,
  NOT_VERIFIED_EMAIL = 31,
  MOBILE_UNREGISTERED = 32,
  UNKNOWN_PHONE_NUMBER = 99,
  SUCCESS_SAME_USER = 100,
  SUCCESS_SAME_USER_BY_MIGRATION = 101,
  TOO_MANY_REQUEST_A_DAY = -20,
  TOO_MANY_REQUEST_AT_A_TIME = -30,
  MISMATCH_PASSCODE = -31,
  EXCEED_DAILY_REQUEST_LIMIT = -32,
  EXCEED_DAILY_REQUEST_LIMIT_VOICECALL = -33,
  EXCEED_DAILY_REQUEST_LIMIT_WITHOUT_TOKEN = -34,
  DEVICE_NOT_REGISTERED = -100,
  ANOTHER_LOGON = -101,
  DEVICE_REGISTER_FAILED = -102,
  INVALID_DEVICE_REGISTER = -110,
  INVALID_PASSCODE = -111,
  PASSCODE_REQUEST_FAILED = -112,
  NEED_TERMS_AGREE = -126,
  DENIED_DEVICE_MODEL = -132,
  RESET_STEP = -940,
  NEED_PROTECTOR_AGREE = -991,
  ACCOUNT_RESTRICTED = -997,
  INVALID_STAGE_ERROR = -998,
  UPGRADE_REQUIRED = -999,
  VOICE_CALL_ONLY = -10002,
  ACCESSIBILITY_ARS_ONLY = -10003,
  MIGRATION_FAILURE = -100001,
  INVAILD_TOKEN = -100002,
  UNDEFINED = -999999,
}

/**
 * Provides default pc login api which can obtain OAuthCredential
 */
export class AuthApiClient {
  private _client: DataWebRequest;

  constructor(
    client: WebClient,
    private _name: string,
    private _deviceUUID: string,
    public config: OAuthLoginConfig,
    public xvcProvider: XVCProvider,
  ) {
    this._client = new DataWebRequest(client);
  }

  get name(): string {
    return this._name;
  }

  get deviceUUID(): string {
    return this._deviceUUID;
  }

  private async createAuthHeader(form: LoginForm): Promise<RequestHeader> {
    const header: RequestHeader = {};

    fillBaseHeader(header, this.config);
    fillAHeader(header, this.config);
    const userAgent = getUserAgent(this.config);
    header['User-Agent'] = userAgent;
    header['X-VC'] = await this.calculateXVCKey(
      this.deviceUUID,
      userAgent,
      form.email,
    );

    return header;
  }

  private fillAuthForm(form: RequestForm): RequestForm {
    form['device_uuid'] = this._deviceUUID;
    form['device_name'] = this._name;

    if (this.config.deviceModel) {
      form['model_name'] = this.config.deviceModel;
    }

    return form;
  }

  /**
   * Login using given data.
   *
   * @param {LoginForm} form
   * @param {boolean} [forced=false] If true, force login even other devices are login
   */
  async login(form: LoginForm, forced = false): AsyncCommandResult<LoginData> {
    const res = await this._client.requestData(
      'POST',
      this.getApiPath('login.json'),
      this.fillAuthForm({ ...form, forced }),
      await this.createAuthHeader(form),
    );
    if (res.status !== KnownDataStatusCode.SUCCESS)
      return { status: res.status, success: false };

    return {
      status: res.status,
      success: true,
      result: structToLoginData(
        res as DefaultRes & AccessDataStruct,
        this._deviceUUID,
      ),
    };
  }

  /**
   * Login using token.
   *
   * @param {TokenLoginForm} form
   * @param {boolean} [forced=false] If true, force login even other devices are login
   */
  async loginToken(
    form: TokenLoginForm,
    forced = false,
  ): AsyncCommandResult<LoginData> {
    const res = await this._client.requestData(
      'POST',
      this.getApiPath('login.json'),
      this.fillAuthForm({ ...form, auto_login: true, forced }),
      await this.createAuthHeader(form),
    );
    if (res.status !== KnownDataStatusCode.SUCCESS)
      return { status: res.status, success: false };

    return {
      status: res.status,
      success: true,
      result: structToLoginData(
        res as DefaultRes & AccessDataStruct,
        this._deviceUUID,
      ),
    };
  }

  /**
   * Request passcode
   *
   * @param {LoginForm} form
   */
  async requestPasscode(form: LoginForm): AsyncCommandResult {
    const res = await this._client.requestData(
      'POST',
      this.getApiPath('request_passcode.json'),
      this.fillAuthForm({ ...form }),
      await this.createAuthHeader(form),
    );

    return {
      status: res.status,
      success: res.status === KnownDataStatusCode.SUCCESS,
    };
  }

  /**
   * Try to register device with passcode
   *
   * @param {LoginForm} form
   * @param {string} passcode
   * @param {boolean} [permanent=true] If true the device will be registered as permanent
   */
  async registerDevice(
    form: LoginForm,
    passcode: string,
    permanent = true,
  ): AsyncCommandResult {
    const res = await this._client.requestData(
      'POST',
      this.getApiPath('register_device.json'),
      this.fillAuthForm({ ...form, passcode, permanent }),
      await this.createAuthHeader(form),
    );

    return {
      status: res.status,
      success: res.status === KnownDataStatusCode.SUCCESS,
    };
  }

  private async calculateXVCKey(
    deviceUUID: string,
    userAgent: string,
    email: string,
  ): Promise<string> {
    return (
      await this.xvcProvider.toFullXVCKey(deviceUUID, userAgent, email)
    ).substring(0, 16);
  }

  private getApiPath(api: string) {
    return `${this.config.agent}/account/${api}`;
  }

  /**
   * Create default AuthClient using config.
   *
   * @param {string} name
   * @param {string} deviceUUID
   * @param {Partial<OAuthLoginConfig>} config
   * @param {XVCProvider} [xvcProvider]
   */
  static async create(
    name: string,
    deviceUUID: string,
    config: Partial<OAuthLoginConfig> = {},
    xvcProvider?: XVCProvider,
  ): Promise<AuthApiClient> {
    return new AuthApiClient(
      await createWebClient('https', 'katalk.kakao.com'),
      name,
      deviceUUID,
      Object.assign({ ...DefaultConfiguration }, config),
      xvcProvider ? xvcProvider : Win32XVCProvider,
    );
  }
}
