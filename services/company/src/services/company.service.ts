import { CompanyRepository } from '../repositories/company.repository';
import { PermissionRepository } from '../repositories/permissions.repository';
import { MemberRepository } from '../repositories/members.repository';
import type { SortOrder } from 'mongoose';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly memberRepository: MemberRepository,
    private readonly permissionRepository: PermissionRepository,
  ) {}

  private mapCompany(company: any) {
    return {
      id: company._id.toString(),
      name: company.name,
      description: company.description,
      ownerId: company.ownerId,
      country: company.country ?? undefined,
      socials: company.socials ?? [],
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  private async mapCompanyWithDetails(company: any) {
    // Get all members without limits
    const members = await this.memberRepository.findAll({ companyId: company._id }, { createdAt: 'asc' });

    // Get all permissions without limits
    const permissions = await this.permissionRepository.findAll({ companyId: company._id }, { createdAt: 'asc' });

    // Group permissions by user
    const userPermissions: Record<string, any[]> = {};
    permissions.forEach((permission) => {
      if (!userPermissions[permission.userId]) {
        userPermissions[permission.userId] = [];
      }
      userPermissions[permission.userId].push({
        id: permission._id.toString(),
        permission: permission.permission,
        entity: permission.entity,
      });
    });

    // Map members with their permissions
    const users = members.map((member) => {
      return {
        id: member._id.toString(),
        userId: member.userId,
        name: member.name,
        permissions: userPermissions[member.userId] || [],
      };
    });

    return {
      id: company._id.toString(),
      name: company.name,
      description: company.description,
      ownerId: company.ownerId,
      country: company.country ?? undefined,
      socials: company.socials ?? [],
      users,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  private mapMember(member: any) {
    return {
      id: member._id.toString(),
      companyId: member.companyId.toString(),
      userId: member.userId,
      name: member.name,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }

  private mapPermission(permission: any) {
    return {
      id: permission._id.toString(),
      companyId: permission.companyId.toString(),
      userId: permission.userId,
      permission: permission.permission,
      entity: permission.entity ?? undefined,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    };
  }

  /**
   * Creates a new company
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ name: a[0].name, description: a[0].description, ownerId: a[0].ownerId, country: a[0].country }),
  })
  async createCompany(data: {
    name: string;
    description: string;
    ownerId: string;
    country?: string;
    socials?: { type: string; url: string }[];
  }) {
    setSpanAttributes({ ownerId: data.ownerId });
    const company = await this.companyRepository.create(data);

    return this.mapCompany(company);
  }

  /**
   * Updates company details
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, name: a[0].updateData.name }),
  })
  async updateCompany(params: {
    id: string;
    updateData: {
      name?: string;
      description?: string;
      country?: string;
      socials?: { type: string; url: string }[];
    };
  }) {
    setSpanAttributes({ entityId: params.id, entityType: 'company' });
    const company = await this.companyRepository.update(params.id, params.updateData);

    return this.mapCompany(company);
  }

  /**
   * Deletes a company and all associated data
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ companyId: a[0] }),
  })
  async deleteCompany(companyId: string) {
    setSpanAttributes({ companyId });
    // Delete all permissions in company
    await this.permissionRepository.deleteMany({ companyId });

    // Delete all members in company
    await this.memberRepository.deleteMany({ companyId });

    // Delete company itself
    await this.companyRepository.delete(companyId);

    return { id: companyId };
  }

  /**
   * Gets company by ID with detailed information including users and their permissions
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async getCompany(id: string) {
    setSpanAttributes({ entityId: id, entityType: 'company' });
    const company = await this.companyRepository.findById(id);
    return this.mapCompanyWithDetails(company);
  }

  /**
   * Gets companies list with basic information
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ limit: a[0].limit, offset: a[0].offset }),
  })
  async getCompanies(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({
      filterKeys: Object.keys(params.filter).join(','),
      limit: params.limit ?? -1,
      offset: params.offset ?? 0,
    });
    const companies = await this.companyRepository.findAll(params.filter, params.sort, params.limit, params.offset);
    return companies.map(c => this.mapCompany(c));
  }

  /**
   * Adds a new member to company
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ name: a[0].name, description: a[0].description, ownerId: a[0].ownerId, country: a[0].country }),
  })
  async addMember(data: { companyId: string; userId: string; name: string }) {
    setSpanAttributes({ companyId: data.companyId, userId: data.userId });
    const member = await this.memberRepository.create(data);
    return this.mapMember(member);
  }

  /**
   * Removes member from company
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ memberId: a[0] }),
  })
  async removeMember(memberId: string) {
    setSpanAttributes({ entityId: memberId, entityType: 'member' });
    // Delete all user permissions in company
    await this.permissionRepository.deleteMany({ memberId });

    // Delete member
    await this.memberRepository.delete(memberId);

    return { id: memberId };
  }

  /**
   * Grants permission to user
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ name: a[0].name, description: a[0].description, ownerId: a[0].ownerId, country: a[0].country }),
  })
  async grantPermission(data: {
    companyId: string;
    memberId: string;
    userId: string;
    permission: string;
    entity: string;
  }) {
    setSpanAttributes({
      companyId: data.companyId,
      userId: data.userId,
      entityId: data.memberId,
      entityType: 'member',
      permission: data.permission,
    });
    const permission = await this.permissionRepository.create(data);
    return this.mapPermission(permission);
  }

  /**
   * Revokes permission from user
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ permissionId: a[0] }),
  })
  async revokePermission(permissionId: string) {
    setSpanAttributes({ entityId: permissionId, entityType: 'permission' });
    await this.permissionRepository.delete(permissionId);
    return { id: permissionId };
  }
}
