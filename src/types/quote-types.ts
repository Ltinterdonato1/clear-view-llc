export interface ServiceJob {
  name: string;
  time: number;
}

export interface LineItem {
  name: string;
  price: number;
}

export interface Discount {
  name: string;
  amount: number;
}

export interface QuoteStats {
  total: string;
  lineItems: LineItem[];
  discounts: Discount[];
  travelFee: number;
  totalMinutes: number;
  timeDisplay: string;
  isBlockRequired: boolean;
  isEnterpriseJob: boolean;
  daysRequired: number;
  serviceJobs: ServiceJob[];
}

export interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  branch: 'Tri-Cities' | 'Walla Walla' | 'Tacoma' | 'Puyallup';
  homeSize: '1-2' | '3-4' | '5+';
  stories: number;
  windowCount: number;
  selectedServices: string[];
  deluxeWindow: boolean;
  skylightCount: number;
  skylightInteriorCount: number;
  trexWash: boolean;
  trexDeckSize: 'none' | 'xs' | 'small' | 'medium' | 'large' | 'xl' | 'xxl';
  cedarFenceRestoration: boolean;
  fenceSize: 'none' | '0-25' | '26-50' | '51-75' | '76-100' | '101-125' | '126-150' | '151+';
  sidingCleaning: boolean;
  backPatio: boolean;
  patioSize: 'none' | 'xs' | 'small' | 'medium' | 'large' | 'xl' | 'xxl';
  drivewaySize: 'none' | '1-2' | '3-4' | '5+';
  roofCleaning: boolean;
  roofBlowOff: boolean;
  mossTreatment: boolean;
  mossAcidWash: boolean;
  solarPanelCleaning: boolean;
  solarPanelCount: number;
  selectedDate: Date | null;
  endDate: Date | null;
  additionalDates?: (Date | null)[];
  timeSlot: string | null;
  endSlot: string | null;
  additionalSlots?: (string | null)[];
  day1SelectedSlotStartTimeMinutes: number | null;
  day1SelectedJobEndTimeMinutes: number | null;
  day2SelectedSlotStartTimeMinutes: number | null;
  day1SelectedJobEndTimeMinutes: number | null;
  day2SelectedJobEndTimeMinutes: number | null;
  isAllDayBlockMode: boolean;
  mode: 'standard' | 'split' | 'allDayBlock' | 'single';
  memo: string;
  otherCity?: string;
  windowType: 'none' | 'exterior' | 'interior' | 'both';
  roofType: string;
  deluxeGutter: boolean;
  gutterFlush: boolean;
  referralEmployee?: string;
  referralSource?: string;
  availableReferralRewards?: number;
  militaryDiscount?: boolean;
}

export interface CalendarStepProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  stats: QuoteStats;
  onNext: () => void;
  onBack: () => void;
}
