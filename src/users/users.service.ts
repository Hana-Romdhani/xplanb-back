import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserRepository } from './users.repository';
import { CreateUserInput } from './dto/createUserDto';
import { hash, compare } from 'bcryptjs';
import { LoginUserDto } from 'src/auth/dto/login-user.input';
import { User } from './users.schema';

@Injectable()
export class UsersService {
  constructor(private userRepository: UserRepository) {}

  async findAll() {
    return this.userRepository.findAll();
  }
  async findOne(id: string) {
    return this.userRepository.findOne(id);
  }

  async create(createUserDto: CreateUserInput) {
    const { password, confirmPassword, firstName, lastName, ...rest } = createUserDto;
    if (password !== confirmPassword) {
      throw new HttpException("Passwords don't match", HttpStatus.UNAUTHORIZED);
    }
    const hashedPassword = await hash(password, 0);
    const user = await this.userRepository.create({
      password: hashedPassword,
      firstName: firstName,
      lastName: lastName,
      ...rest
    });
    return user;
  }

  async update(id: string, updateUserDto: Partial<User>) {
    // If password update is requested, verify current password
    if (updateUserDto.password && (updateUserDto as any).currentPassword) {
      const user = await this.userRepository.getOneWithPasswordById(id);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const isCurrentPasswordValid = await compare(
        (updateUserDto as any).currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        throw new HttpException('Current password is incorrect', HttpStatus.UNAUTHORIZED);
      }
    }

    return this.userRepository.update(id, updateUserDto);
  }

  async resetPassword(id: string, password: string) {
    return this.update(id, {
      password,
      resetToken: null,
      resetTokenExpiry: null
    });
  }
  async delete(id: string) {
    return this.userRepository.delete(id);
  }
  async findById(id: string): Promise<User | null> {
    return this.userRepository.getOneWithPasswordById(id);
  }

  async findOneByEmail(email: string) {
    return this.userRepository.findOneByEmail(email);
  }

  async login({ email, password }: LoginUserDto) {
    const user = await this.userRepository.getOneWithPassword({
      where: { email }
    });
    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    const areEqual = await compare(password, user.password);

    if (!areEqual) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    const { password: p, ...rest } = user;
    return rest;
  }

  async findOneByResetToken(token: string): Promise<User | null> {
    return this.userRepository.getOneWithPassword({
      where: {
        resetToken: token
      }
    });
  }
  async findOneByEmailWithPassword(email: string) {
    return this.userRepository.getOneWithPassword({
      where: { email }
    });
  }

  async findOneByVerificationToken(token: string): Promise<User | null> {
    return this.userRepository.getOneWithPassword({
      where: {
        emailVerificationToken: token
      }
    });
  }

  async findUsersByIds(ids: string[], selectFields: string[] = []) {
    return this.userRepository.findUsersByIds(ids, selectFields);
  }
}
