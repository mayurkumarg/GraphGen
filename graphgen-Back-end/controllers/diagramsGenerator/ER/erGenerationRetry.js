import CustomError from "../../../utils/customError.js";

const MAX_ATTEMPTS = 3;
const INITIAL_DELAY_MS = 500;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const getHttpStatus = (error) =>
  Number(error?.status ?? error?.statusCode ?? error?.error?.code);

const toHttpError = (error, statusCode) => {
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
    return new CustomError(statusCode, error.message);
  }

  return error;
};

async function generateErContentWithRetry(generateContent, options = {}) {
  const wait = options.sleep || sleep;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await generateContent();
    } catch (error) {
      const statusCode = getHttpStatus(error);

      if (statusCode === 503 && attempt < MAX_ATTEMPTS) {
        await wait(INITIAL_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      throw toHttpError(error, statusCode);
    }
  }
}

export default generateErContentWithRetry;
