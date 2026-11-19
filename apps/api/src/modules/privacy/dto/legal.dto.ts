import { ApiProperty } from '@nestjs/swagger';

import { ConsentType } from '../../../generated/prisma/enums.js';

export class LegalDocumentSummaryDto {
  @ApiProperty({ enum: ConsentType, enumName: 'ConsentType' })
  type!: ConsentType;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  required!: boolean;

  @ApiProperty({ enum: ['acknowledgement', 'consent'] })
  kind!: 'acknowledgement' | 'consent';

  @ApiProperty()
  title!: string;
}

export class LegalDocumentDto extends LegalDocumentSummaryDto {
  @ApiProperty({ description: 'Markdown' })
  body!: string;
}

export class LegalDocumentResponseDto {
  @ApiProperty({ type: LegalDocumentDto })
  data!: LegalDocumentDto;
}

export class AppConfigDto {
  @ApiProperty({ example: '0.1.0', description: 'Bu sürümün altındaki uygulamalar güncellenmeli' })
  minimumAppVersion!: string;

  @ApiProperty({ type: [LegalDocumentSummaryDto] })
  legalDocuments!: LegalDocumentSummaryDto[];
}

export class AppConfigResponseDto {
  @ApiProperty({ type: AppConfigDto })
  data!: AppConfigDto;
}
