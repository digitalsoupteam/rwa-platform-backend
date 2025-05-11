import { logger } from "@shared/monitoring/src/logger";
import { CompanyRepository } from "../repositories/company.repository";
import { PermissionRepository } from "../repositories/permissions.repository";
import { MemberRepository } from "../repositories/members.repository";
import { SortOrder } from "mongoose";

export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly memberRepository: MemberRepository,
    private readonly permissionRepository: PermissionRepository
  ) { }

  private mapCompany(company: any) {
    return {
      id: company._id.toString(),
      name: company.name,
      description: company.description,
      ownerId: company.ownerId,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt
    };
  }

  private async mapCompanyWithDetails(company: any) {
    // Get all members without limits
    const members = await this.memberRepository.findAll(
      { companyId: company._id },
      { createdAt: 'asc' }
    );

    // Get all permissions without limits
    const permissions = await this.permissionRepository.findAll(
      { companyId: company._id },
      { createdAt: 'asc' }
    );

    // Group permissions by user
    const userPermissions: Record<string, any[]> = {};
    permissions.forEach(permission => {
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
    const users = members.map(member => {
      return {
        id: member._id.toString(),
        userId: member.userId,
        name: member.name,
        permissions: userPermissions[member.userId] || [],
      }
    });

    return {
      id: company._id.toString(),
      name: company.name,
      description: company.description,
      ownerId: company.ownerId,
      users,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt
    };
  }

  private mapMember(member: any) {
    return {
      id: member._id.toString(),
      companyId: member.companyId.toString(),
      userId: member.userId,
      name: member.name,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt
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
      updatedAt: permission.updatedAt
    };
  }

  /**
   * Creates a new company
   */
  async createCompany(data: {
    name: string;
    description: string;
    ownerId: string;
  }) {
    logger.debug("Creating new company", { name: data.name });

    const company = await this.companyRepository.create(data);

    return this.mapCompany(company);
  }

  /**
   * Updates company details
   */
  async updateCompany(params: {
    id: string;
    updateData: {
      name?: string;
      description?: string;
    }
  }) {
    logger.debug("Updating company", params);

    const company = await this.companyRepository.update(
      params.id,
      params.updateData
    );

    return this.mapCompany(company);
  }

  /**
   * Deletes a company and all associated data
   */
  async deleteCompany(companyId: string) {
    logger.debug("Deleting company and associated data", companyId);

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
  async getCompany(id: string) {
    logger.debug("Getting company with details", { id });
    const company = await this.companyRepository.findById(id);
    return this.mapCompanyWithDetails(company);
  }

  /**
   * Gets companies list with basic information
   */
  async getCompanies(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting companies list", params);
    const companies = await this.companyRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );
    return companies.map(this.mapCompany);
  }

  /**
   * Adds a new member to company
   */
  async addMember(data: {
    companyId: string;
    userId: string;
    name: string;
  }) {
    logger.debug("Adding new member", { companyId: data.companyId, userId: data.userId });
    const member = await this.memberRepository.create(data);
    return this.mapMember(member);
  }

  /**
   * Removes member from company
   */
  async removeMember(memberId: string) {
    logger.debug("Removing member", memberId);

    // Delete all user permissions in company
    await this.permissionRepository.deleteMany({ memberId });

    // Delete member
    await this.memberRepository.delete(memberId);

    return { id: memberId };
  }

  /**
   * Grants permission to user
   */
  async grantPermission(data: {
    companyId: string;
    memberId: string;
    userId: string;
    permission: string;
    entity: string;
  }) {
    logger.debug("Granting permission", data);
    const permission = await this.permissionRepository.create(data);
    return this.mapPermission(permission);
  }

  /**
   * Revokes permission from user
   */
  async revokePermission(permissionId: string) {
    logger.debug("Revoking permission", { permissionId });
    await this.permissionRepository.delete(permissionId);
    return { id: permissionId };
  }
}