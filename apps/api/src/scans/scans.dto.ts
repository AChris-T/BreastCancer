import { Transform, Type } from 'class-transformer';
import { Equals, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { HER2_STATUSES, IMAGE_STAINS, RECEPTOR_STATUSES, SCAN_TYPES, SUBTYPES, type ClinicalDetails, type Subtype } from '@breastscan/shared';
import type { ScanType } from '../generated/prisma/client.js';

/** Multipart fields arrive as strings; blank means "not given". */
const blankToUndefined = ({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value);
const toInt = ({ value }: { value: unknown }) => (value === '' || value === null || value === undefined ? undefined : Number(value));
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

export class UploadScanDto {
  @IsIn(SCAN_TYPES)
  declaredType: ScanType;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsDateString({ strict: true })
  examDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Clinical details entered by the doctor.

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  patientRef?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1950)
  @Max(2100)
  diagnosisYear?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  @Max(120)
  patientAge?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  location?: string;

  @IsOptional()
  @Transform(toInt)
  @IsIn([1, 2, 3])
  grade?: 1 | 2 | 3;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(3)
  @Max(9)
  gradeScore?: number;

  @IsIn(RECEPTOR_STATUSES)
  erStatus: ClinicalDetails['erStatus'];

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  @Max(100)
  erPercent?: number;

  @IsIn(RECEPTOR_STATUSES)
  prStatus: ClinicalDetails['prStatus'];

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  @Max(100)
  prPercent?: number;

  @IsIn(HER2_STATUSES)
  her2Status: ClinicalDetails['her2Status'];

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  @Max(100)
  ki67Percent?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  diagnosis?: string;

  /** Which stain a pathology image shows; ER, PR and Ki-67 look alike without this. */
  @IsOptional()
  @Transform(blankToUndefined)
  @IsIn(IMAGE_STAINS)
  imageStain?: ClinicalDetails['imageStain'];

  /** The "decision support only" tick on the upload form. */
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @Equals(true, { message: 'Please confirm this is decision support, not a diagnosis' })
  acknowledged: boolean;
}

export function toClinicalDetails(dto: UploadScanDto): ClinicalDetails {
  return {
    patientRef: dto.patientRef ?? null,
    diagnosisYear: dto.diagnosisYear ?? null,
    patientAge: dto.patientAge ?? null,
    location: dto.location ?? null,
    grade: dto.grade ?? null,
    gradeScore: dto.gradeScore ?? null,
    erStatus: dto.erStatus,
    erPercent: dto.erPercent ?? null,
    prStatus: dto.prStatus,
    prPercent: dto.prPercent ?? null,
    her2Status: dto.her2Status,
    ki67Percent: dto.ki67Percent ?? null,
    diagnosis: dto.diagnosis ?? null,
    imageStain: dto.declaredType === 'PATHOLOGY' ? (dto.imageStain ?? null) : null,
  };
}

export class ListScansQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsIn(SCAN_TYPES)
  type?: ScanType;

  @IsOptional()
  @IsIn(SUBTYPES)
  classification?: Subtype;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class FeedbackDto {
  @IsBoolean()
  helpful: boolean;

  @IsOptional()
  @IsBoolean()
  doctorAgreed?: boolean | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
