/* tslint:disable:max-file-line-count */
import expressPresenter from '@learninglocker/xapi-agents/dist/expressPresenter';
import fetchAuthRepo from '@learninglocker/xapi-agents/dist/fetchAuthRepo';
import localStorageRepo from '@learninglocker/xapi-agents/dist/localStorageRepo';
import memoryModelsRepo from '@learninglocker/xapi-agents/dist/memoryModelsRepo';
import AgentProfile from '@learninglocker/xapi-agents/dist/models/Profile';
import mongoAuthRepo from '@learninglocker/xapi-agents/dist/mongoAuthRepo';
import mongoModelsRepo from '@learninglocker/xapi-agents/dist/mongoModelsRepo';
import s3StorageRepo from '@learninglocker/xapi-agents/dist/s3StorageRepo';
import service from '@learninglocker/xapi-agents/dist/service';
import testAuthRepo from '@learninglocker/xapi-agents/dist/testAuthRepo';
import enTranslator from '@learninglocker/xapi-agents/dist/translatorFactory/en';
import { S3 } from 'aws-sdk';
import { MongoClient } from 'mongodb';
import config from '../config';
import logger from '../logger';
import tracker from '../tracker';

const getAuthRepo = () => {
  switch (config.repoFactory.authRepoName) {
    case 'test':
      return testAuthRepo({});
    case 'fetch':
      return fetchAuthRepo({
        llClientInfoEndpoint: config.fetchAuthRepo.llClientInfoEndpoint,
      });
    default: case 'mongo':
      return mongoAuthRepo({
        db: MongoClient.connect(config.mongoModelsRepo.url),
      });
  }
};

const getModelsRepo = () => {
  switch (config.repoFactory.modelsRepoName) {
    case 'mongo':
      return mongoModelsRepo({
        db: MongoClient.connect(config.mongoModelsRepo.url),
      });
    default: case 'memory':
      return memoryModelsRepo({
        state: { agentProfiles: [] as AgentProfile[] },
      });
  }
};

const getStorageRepo = () => {
  switch (config.repoFactory.storageRepoName) {
    case 's3':
      return s3StorageRepo({
        bucketName: config.s3StorageRepo.bucketName,
        client: new S3(config.s3StorageRepo.awsConfig),
        subFolder: config.storageSubFolders.statements,
      });
    default:
    case 'local': {
      const statementsStorageDir = (
        `${config.localStorageRepo.storageDir}/${config.storageSubFolders.statements}`
      );
      return localStorageRepo({
        storageDir: statementsStorageDir,
      });
    }
  }
};

const getRepoFacade = () => {
  const modelsRepo = getModelsRepo();
  const storageRepo = getStorageRepo();
  const authRepo = getAuthRepo();

  return {
    ...authRepo,
    ...modelsRepo,
    ...storageRepo,

    clearRepo: async () => {
      await modelsRepo.clearRepo();
      await storageRepo.clearRepo();
    },
    migrate: async () => {
      await modelsRepo.migrate();
      await storageRepo.migrate();
    },
    rollback: async () => {
      await modelsRepo.rollback();
      await storageRepo.rollback();
    },
  };
};

const getTranslatorFacade = () => {
  switch (config.lang) {
    case 'en':
    default:
      return enTranslator;
  }
};

const repoFacade = getRepoFacade();
const serviceFacade = service({ repo: repoFacade });
const expressFacade = expressPresenter({
  bodyParserLimit: config.express.bodyParserLimit,
  customRoute: 'xAPI/agents/profile/status',
  customRouteText: 'ok',
  logger,
  morganDirectory: config.express.morganDirectory,
  service: serviceFacade,
  tracker,
  translator: getTranslatorFacade(),
});

export default expressFacade;
