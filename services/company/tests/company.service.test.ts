/**
 * Unit tests for CompanyService.
 *
 * Scope: the service layer only. Repositories are replaced with in-memory
 * fakes (tests/fakes/*.fake.ts), so these tests need no database, no broker
 * and no network. Run with `bun test` from services/company.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { CompanyService } from '../src/services/company.service';
import type { CompanyRepository } from '../src/repositories/company.repository';
import type { MemberRepository } from '../src/repositories/members.repository';
import type { PermissionRepository } from '../src/repositories/permissions.repository';
import { createFakeCompanyRepository, type FakeCompanyRepository } from './fakes/company.repository.fake';
import { createFakeMemberRepository, type FakeMemberRepository } from './fakes/members.repository.fake';
import { createFakePermissionRepository, type FakePermissionRepository } from './fakes/permissions.repository.fake';

const COMPANY = {
  name: 'Acme RWA',
  description: 'Tokenized real estate platform',
  ownerId: 'owner-1',
  country: 'US',
  socials: [{ type: 'website', url: 'https://acme.example' }],
};

describe('CompanyService (unit, fake repositories)', () => {
  let companies: FakeCompanyRepository;
  let members: FakeMemberRepository;
  let permissions: FakePermissionRepository;
  let service: CompanyService;

  beforeEach(() => {
    companies = createFakeCompanyRepository();
    members = createFakeMemberRepository();
    permissions = createFakePermissionRepository();
    service = new CompanyService(
      companies as unknown as CompanyRepository,
      members as unknown as MemberRepository,
      permissions as unknown as PermissionRepository,
    );
  });

  test('createCompany: forwards the payload and returns a mapped company', async () => {
    const company = await service.createCompany(COMPANY);

    expect(companies.create).toHaveBeenCalledTimes(1);
    expect(companies.create).toHaveBeenCalledWith(COMPANY);
    expect(company).toMatchObject(COMPANY);
    expect(typeof company.id).toBe('string');
    expect(company.id).toHaveLength(24); // Mongo ObjectId hex
    expect(typeof company.createdAt).toBe('number');
    expect(company).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(company))).toEqual(company);
  });

  test('createCompany: leaves country undefined and defaults socials to an empty array', async () => {
    const company = await service.createCompany({
      name: COMPANY.name,
      description: COMPANY.description,
      ownerId: COMPANY.ownerId,
    });

    expect(companies.create).toHaveBeenCalledWith({
      name: COMPANY.name,
      description: COMPANY.description,
      ownerId: COMPANY.ownerId,
    });
    expect(company.country).toBeUndefined();
    expect(company.socials).toEqual([]);
  });

  test('updateCompany: forwards the partial update and returns the mapped company', async () => {
    const created = await service.createCompany(COMPANY);

    const updated = await service.updateCompany({ id: created.id, updateData: { name: 'Renamed' } });

    expect(companies.update).toHaveBeenCalledWith(created.id, { name: 'Renamed' });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
    expect(updated.description).toBe(COMPANY.description);
  });

  test('updateCompany: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.updateCompany({ id: 'unknown-id', updateData: { name: 'x' } })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getCompany: returns the company with members and their permissions grouped by user', async () => {
    const created = await service.createCompany(COMPANY);
    const alice = await service.addMember({ companyId: created.id, userId: 'user-1', name: 'Alice' });
    const bob = await service.addMember({ companyId: created.id, userId: 'user-2', name: 'Bob' });
    await service.grantPermission({
      companyId: created.id,
      memberId: alice.id,
      userId: 'user-1',
      permission: 'admin',
      entity: 'company',
    });
    await service.grantPermission({
      companyId: created.id,
      memberId: alice.id,
      userId: 'user-1',
      permission: 'read',
      entity: 'assets',
    });

    const company = await service.getCompany(created.id);

    // The service forwards the raw ObjectId it received from the repository.
    const companyId = companies.store.get(created.id)?._id;
    expect(companies.findById).toHaveBeenCalledWith(created.id);
    expect(members.findAll).toHaveBeenCalledWith({ companyId }, { createdAt: 'asc' });
    expect(permissions.findAll).toHaveBeenCalledWith({ companyId }, { createdAt: 'asc' });
    expect(company.id).toBe(created.id);
    expect(company.name).toBe(COMPANY.name);
    expect(company.users).toHaveLength(2);
    expect(company.users[0]).toMatchObject({ id: alice.id, userId: 'user-1', name: 'Alice' });
    expect(company.users[0].permissions.map((p) => p.permission)).toEqual(['admin', 'read']);
    expect(company.users[0].permissions[0]).not.toHaveProperty('_id');
    expect(company.users[1]).toMatchObject({ id: bob.id, userId: 'user-2', name: 'Bob', permissions: [] });
    expect(JSON.parse(JSON.stringify(company))).toEqual(company);
  });

  test('getCompany: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getCompany('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getCompanies: passes filter/sort/pagination through and maps every result', async () => {
    await service.createCompany(COMPANY);
    await service.createCompany({ ...COMPANY, name: 'Second', ownerId: 'owner-2' });
    await service.createCompany({ ...COMPANY, name: 'Third', ownerId: 'owner-2' });

    const result = await service.getCompanies({
      filter: { ownerId: 'owner-2' },
      sort: { name: 'asc' },
      limit: 10,
      offset: 0,
    });

    expect(companies.findAll).toHaveBeenCalledWith({ ownerId: 'owner-2' }, { name: 'asc' }, 10, 0);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name)).toEqual(['Second', 'Third']); // insertion order is stable in the fake
    for (const company of result) {
      expect(company).not.toHaveProperty('_id');
      expect(typeof company.id).toBe('string');
    }
  });

  test('getCompanies: applies limit/offset to the returned slice', async () => {
    await service.createCompany(COMPANY);
    await service.createCompany({ ...COMPANY, name: 'Second' });
    await service.createCompany({ ...COMPANY, name: 'Third' });

    const result = await service.getCompanies({ filter: {}, limit: 1, offset: 1 });

    expect(companies.findAll).toHaveBeenCalledWith({}, undefined, 1, 1);
    expect(result.map((c) => c.name)).toEqual(['Second']);
  });

  test('getCompanies: returns an empty array when nothing matches', async () => {
    await service.createCompany(COMPANY);

    const result = await service.getCompanies({ filter: { ownerId: 'nobody' } });

    expect(result).toEqual([]);
  });

  test('deleteCompany: deletes permissions, then members, then the company itself', async () => {
    const company = await service.createCompany(COMPANY);
    const otherCompany = await service.createCompany({ ...COMPANY, name: 'Other' });
    const member = await service.addMember({ companyId: company.id, userId: 'user-1', name: 'Alice' });
    const foreignMember = await service.addMember({ companyId: otherCompany.id, userId: 'user-2', name: 'Bob' });
    const foreignPermission = await service.grantPermission({
      companyId: otherCompany.id,
      memberId: foreignMember.id,
      userId: 'user-2',
      permission: 'read',
      entity: 'company',
    });

    const result = await service.deleteCompany(company.id);

    expect(result).toEqual({ id: company.id });
    expect(permissions.deleteMany).toHaveBeenCalledWith({ companyId: company.id });
    expect(members.deleteMany).toHaveBeenCalledWith({ companyId: company.id });
    expect(companies.delete).toHaveBeenCalledWith(company.id);
    expect(members.store.has(member.id)).toBe(false);
    expect(companies.store.has(company.id)).toBe(false);
    // Data of other companies is left untouched.
    expect(members.store.has(foreignMember.id)).toBe(true);
    expect(permissions.store.has(foreignPermission.id)).toBe(true);
    expect(companies.store.has(otherCompany.id)).toBe(true);
  });

  test('deleteCompany: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteCompany('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('addMember: forwards the payload and returns a mapped member', async () => {
    const company = await service.createCompany(COMPANY);

    const member = await service.addMember({ companyId: company.id, userId: 'user-1', name: 'Alice' });

    expect(members.create).toHaveBeenCalledWith({ companyId: company.id, userId: 'user-1', name: 'Alice' });
    expect(member.companyId).toBe(company.id); // ObjectId is mapped back to a string
    expect(member.userId).toBe('user-1');
    expect(member.name).toBe('Alice');
    expect(typeof member.id).toBe('string');
    expect(member).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(member))).toEqual(member);
  });

  test('removeMember: deletes the member permissions, then the member itself', async () => {
    const company = await service.createCompany(COMPANY);
    const first = await service.addMember({ companyId: company.id, userId: 'user-1', name: 'Alice' });
    const second = await service.addMember({ companyId: company.id, userId: 'user-2', name: 'Bob' });
    const firstPermission = await service.grantPermission({
      companyId: company.id,
      memberId: first.id,
      userId: 'user-1',
      permission: 'admin',
      entity: 'company',
    });
    const secondPermission = await service.grantPermission({
      companyId: company.id,
      memberId: second.id,
      userId: 'user-2',
      permission: 'read',
      entity: 'assets',
    });

    const result = await service.removeMember(first.id);

    expect(result).toEqual({ id: first.id });
    expect(permissions.deleteMany).toHaveBeenCalledWith({ memberId: first.id });
    expect(members.delete).toHaveBeenCalledWith(first.id);
    expect(permissions.store.has(firstPermission.id)).toBe(false);
    expect(members.store.has(first.id)).toBe(false);
    // The other member and its permissions are left untouched.
    expect(permissions.store.has(secondPermission.id)).toBe(true);
    expect(members.store.has(second.id)).toBe(true);
  });

  test('removeMember: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.removeMember('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('grantPermission: forwards the payload and returns a mapped permission', async () => {
    const company = await service.createCompany(COMPANY);
    const member = await service.addMember({ companyId: company.id, userId: 'user-1', name: 'Alice' });

    const permission = await service.grantPermission({
      companyId: company.id,
      memberId: member.id,
      userId: 'user-1',
      permission: 'admin',
      entity: 'company',
    });

    expect(permissions.create).toHaveBeenCalledWith({
      companyId: company.id,
      memberId: member.id,
      userId: 'user-1',
      permission: 'admin',
      entity: 'company',
    });
    expect(permission.companyId).toBe(company.id);
    expect(permission.userId).toBe('user-1');
    expect(permission.permission).toBe('admin');
    expect(permission.entity).toBe('company');
    expect(typeof permission.id).toBe('string');
    expect(permission).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(permission))).toEqual(permission);
  });

  test('revokePermission: deletes only the requested permission', async () => {
    const company = await service.createCompany(COMPANY);
    const member = await service.addMember({ companyId: company.id, userId: 'user-1', name: 'Alice' });
    const first = await service.grantPermission({
      companyId: company.id,
      memberId: member.id,
      userId: 'user-1',
      permission: 'admin',
      entity: 'company',
    });
    const second = await service.grantPermission({
      companyId: company.id,
      memberId: member.id,
      userId: 'user-1',
      permission: 'read',
      entity: 'assets',
    });

    const result = await service.revokePermission(first.id);

    expect(result).toEqual({ id: first.id });
    expect(permissions.store.has(first.id)).toBe(false);
    expect(permissions.store.has(second.id)).toBe(true);
  });

  test('revokePermission: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.revokePermission('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});
