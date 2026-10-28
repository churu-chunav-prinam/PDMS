import { PASSWORD_REASONS } from '../rules/credentials';
import { ApiError } from './client';

// Hindi text for every API error code the user can meet. Unknown codes get the generic line.
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'गलत यूज़रनेम या पासवर्ड',
  ACCOUNT_LOCKED: 'बहुत बार गलत पासवर्ड। खाता कुछ देर के लिए बंद है।',
  TOO_MANY_REQUESTS: 'बहुत अधिक प्रयास। थोड़ी देर बाद पुनः प्रयास करें।',
  VALIDATION_FAILED: 'जानकारी सही भरें',
  BOOTH_HAS_OFFICER: 'इस बूथ पर पहले से अधिकारी है',
  BOOTH_NOT_FOUND: 'बूथ नहीं मिला',
  OFFICER_NOT_FOUND: 'अधिकारी नहीं मिला',
  REAUTH_FAILED: 'आपका पासवर्ड गलत है',
  FILE_INVALID: 'फ़ाइल सही नहीं है (Excel .xlsx, सही कॉलम)',
  FILE_TOO_LARGE: 'फ़ाइल बहुत बड़ी है',
  BULK_HAS_PROBLEMS: 'कुछ पंक्तियों में त्रुटि है। पहले सुधारें।',
  SESSION_EXPIRED: 'सत्र समाप्त। पुनः लॉगिन करें।',
  UNAUTHENTICATED: 'पुनः लॉगिन करें',
  FORBIDDEN: 'अनुमति नहीं है',
  NETWORK: 'नेटवर्क समस्या। पुनः प्रयास करें।',
  STEP_NOT_OPEN: 'यह चरण अभी शुरू नहीं हुआ है',
  STEP_NOT_FOUND: 'यह चरण उपलब्ध नहीं है',
  ALREADY_REPORTED: 'यह चरण पहले ही दर्ज है',
  NOT_REPORTED: 'यह चरण अभी दर्ज नहीं है',
  NO_CHANGE: 'कोई बदलाव नहीं किया',
  REPORT_INVALID: 'संख्या सही नहीं है',
  ISSUE_ALREADY_OPEN: 'एक समस्या पहले से चल रही है। पहले उसे हल करें।',
  ISSUE_NOT_OPEN: 'यह समस्या पहले ही हल हो चुकी है',
  ISSUE_NOT_FOUND: 'समस्या नहीं मिली',
  NO_OFFICER_ACCOUNT: 'इस बूथ के लिए खाता नहीं बना है',
  USERNAME_TAKEN: 'यह यूज़रनेम पहले से किसी और का है। दूसरा यूज़रनेम चुनें।',
  PASSWORD_WEAK: 'पासवर्ड कमज़ोर है',
  STEP_HAS_REPORTS: 'इस चरण में रिपोर्ट दर्ज हैं: केवल बंद (निष्क्रिय) किया जा सकता है',
  ORDER_TAKEN: 'इस क्रम संख्या पर पहले से एक चरण है',
  DUE_BEFORE_OPENS: '"समय सीमा" "खुलने के समय" से पहले नहीं हो सकती',
  NUMBER_LABEL_REQUIRED: 'संख्या वाले चरण के लिए लेबल भरें',
};

const FIELD_HI: Record<string, string> = { male: 'पुरुष', female: 'महिला', third: 'तृतीय लिंग' };

interface Problem {
  code: string;
  field?: string;
  previous?: number;
  next?: number;
  total?: number;
  registeredVoters?: number;
  step?: { nameHi: string };
}

/** One Hindi line per rule problem the server returned (REPORT_INVALID). */
export function problemLines(err: unknown): string[] {
  if (!(err instanceof ApiError) || !Array.isArray(err.body.problems)) return [];
  return (err.body.problems as Problem[]).map((p) => {
    const field = FIELD_HI[p.field ?? ''] ?? '';
    switch (p.code) {
      case 'BELOW_PREVIOUS':
        return `${field}: "${p.step?.nameHi ?? ''}" में ${p.previous ?? 0} थे। मतदान कम नहीं हो सकता।`;
      case 'ABOVE_NEXT':
        return `${field}: "${p.step?.nameHi ?? ''}" में ${p.next ?? 0} दर्ज हैं। इससे अधिक नहीं हो सकता।`;
      case 'EXCEEDS_REGISTERED':
        return `कुल ${p.total ?? 0} है, पर पंजीकृत मतदाता केवल ${p.registeredVoters ?? 0} हैं।`;
      case 'TURNOUT_REQUIRED':
        return 'पुरुष, महिला और तृतीय लिंग, तीनों संख्या भरें (0 भी चलेगा)।';
      case 'VALUE_REQUIRED':
        return 'संख्या भरें।';
      default:
        return 'संख्या सही नहीं है।';
    }
  });
}

export function errorText(err: unknown): string {
  if (err instanceof ApiError && err.code === 'PASSWORD_WEAK' && typeof err.body.reason === 'string') {
    return PASSWORD_REASONS[err.body.reason] ?? MESSAGES.PASSWORD_WEAK ?? '';
  }
  if (err instanceof ApiError) return MESSAGES[err.code] ?? 'कुछ गलत हुआ। पुनः प्रयास करें।';
  return MESSAGES.NETWORK ?? '';
}
