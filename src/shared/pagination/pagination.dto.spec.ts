import 'reflect-metadata';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { PaginatedResponseDto } from './pagination.dto';

class SampleItemDto {
  @ApiProperty()
  id!: string;
}

class OtherItemDto {
  @ApiProperty()
  name!: string;
}

describe('PaginatedResponseDto', () => {
  it('When instantiated, then it exposes data and meta', () => {
    const Dto = PaginatedResponseDto(SampleItemDto);
    const instance = new Dto();
    instance.data = [{ id: 'a' }];
    instance.meta = {
      hasNextPage: false,
      hasPreviousPage: false,
      limit: 20,
      page: 1,
      total: 1,
      totalPages: 1,
    };

    expect(instance.data).toEqual([{ id: 'a' }]);
    expect(instance.meta.total).toBe(1);
    expect(Dto.name).toBe('PaginatedSampleItemDtoResponseDto');
  });

  it('When called for different item DTOs, then both classes behave independently', () => {
    const SampleDto = PaginatedResponseDto(SampleItemDto);
    const OtherDto = PaginatedResponseDto(OtherItemDto);

    expect(SampleDto).not.toBe(OtherDto);
    expect(SampleDto.name).toBe('PaginatedSampleItemDtoResponseDto');
    expect(OtherDto.name).toBe('PaginatedOtherItemDtoResponseDto');

    const sampleInstance = new SampleDto();
    sampleInstance.data = [{ id: 'a' }];
    const otherInstance = new OtherDto();
    otherInstance.data = [{ name: 'b' }];

    expect(sampleInstance.data).toEqual([{ id: 'a' }]);
    expect(otherInstance.data).toEqual([{ name: 'b' }]);
  });

  it('When used in an OpenAPI document, then data resolves to an array of the item schema', async () => {
    @ApiExtraModels(SampleItemDto)
    class SamplePaginatedResponseDto extends PaginatedResponseDto(
      SampleItemDto,
    ) {}
    const OtherPaginatedResponseDto = PaginatedResponseDto(OtherItemDto);

    @Controller('sample')
    class SampleController {
      @ApiOkResponse({ type: SamplePaginatedResponseDto })
      @Get()
      list() {
        return { data: [], meta: {} };
      }
    }

    @Controller('other')
    class OtherController {
      @ApiOkResponse({ type: OtherPaginatedResponseDto })
      @Get()
      list() {
        return { data: [], meta: {} };
      }
    }

    @Module({ controllers: [OtherController, SampleController] })
    class SampleModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [SampleModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    await app.close();

    const responseSchema = document.paths['/sample']?.get?.responses?.['200'];
    const schemaRef =
      responseSchema && 'content' in responseSchema
        ? responseSchema.content?.['application/json']?.schema
        : undefined;

    expect(schemaRef).toEqual({
      $ref: '#/components/schemas/SamplePaginatedResponseDto',
    });

    const wrapperSchema =
      document.components?.schemas?.['SamplePaginatedResponseDto'];
    const dataSchema =
      wrapperSchema && 'properties' in wrapperSchema
        ? wrapperSchema.properties?.data
        : undefined;

    expect(dataSchema).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/SampleItemDto' },
    });
    expect(document.components?.schemas?.['SampleItemDto']).toBeDefined();
    expect(
      document.components?.schemas?.['PaginatedOtherItemDtoResponseDto'],
    ).toBeDefined();
  });
});
