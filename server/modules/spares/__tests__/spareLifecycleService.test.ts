import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  getSpare: vi.fn(),
  deleteSpare: vi.fn(),
  updateSpare: vi.fn(),
}));

vi.mock('../repositories/sparesRepository', () => repo);

import * as service from '../services/sparesService';

const activeSpare = {
  id: 10,
  vesselId: 'vessel-1',
  partName: 'Valve Kit',
  partCode: 'VK-1',
  isActive: true,
  isDeleted: false,
  deleted: false,
};

describe('Spare lifecycle service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retained-deletes only the requested vessel Spare', async () => {
    repo.getSpare.mockResolvedValue(activeSpare);

    await expect(service.deleteSpare('10', 'vessel-1', 'office-user')).resolves.toMatchObject({
      success: true,
      message: expect.stringContaining('Inventory and transaction history have been retained'),
    });

    expect(repo.deleteSpare).toHaveBeenCalledWith('10', 'office-user');
  });

  it('does not allow a Spare from another vessel to be deleted', async () => {
    repo.getSpare.mockResolvedValue(activeSpare);

    await expect(service.deleteSpare('10', 'vessel-2', 'office-user')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(repo.deleteSpare).not.toHaveBeenCalled();
  });

  it('keeps inactivation separate from retained deletion', async () => {
    repo.getSpare.mockResolvedValue(activeSpare);

    await service.inactivateSpare('10', 'vessel-1');

    expect(repo.updateSpare).toHaveBeenCalledWith('10', { isActive: false });
    expect(repo.deleteSpare).not.toHaveBeenCalled();
  });

  it('rejects deletion markers in an ordinary update', async () => {
    await expect(service.updateSpare('10', { isDeleted: true }, 'office-user')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(repo.updateSpare).not.toHaveBeenCalled();
  });
});